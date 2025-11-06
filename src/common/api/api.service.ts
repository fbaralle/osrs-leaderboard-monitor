import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { db, schema } from 'src/db';
import { desc, eq, sql } from 'drizzle-orm';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

import {
  RankItemResponse,
  RankWithHistoryResponse,
  RankWithHistoryDB,
  UserHistoryResponse,
} from 'src/shared/types';
import { timestampToDateString } from '../indexer/helpers/parse';
import {
  CURRENT_LEADERBOARD_CACHE_KEY,
  CURRENT_RANK_HISTORY_CACHE_KEY,
  FIVE_MINUTES_IN_MS,
} from 'src/config';

@Injectable()
export class ApiService {
  private readonly logger = new Logger(ApiService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getCurrentLeaderboard() {
    this.logger.log('Get current leaderboard');

    const cachedData = await this.cacheManager.get(
      CURRENT_LEADERBOARD_CACHE_KEY,
    );

    if (cachedData) {
      this.logger.debug('Serving current leaderboard data from cache');
      return cachedData as Array<RankItemResponse>;
    }

    const leaderboard: Array<RankItemResponse> = await db.all(sql`
      WITH latest AS (
      SELECT
        "userName",
        "score",
        "rank",
        "updatedAtTimestamp",
        ROW_NUMBER() OVER (
          PARTITION BY "userName"
          ORDER BY "updatedAtTimestamp" DESC
        ) AS rn
      FROM "score_updates"
    )
    SELECT
      "userName",
      "score",
      "rank",
      strftime('%Y-%m-%dT%H:%M:%fZ', "updatedAtTimestamp" / 1000, 'unixepoch') AS "lastUpdated"
    FROM latest
    WHERE rn = 1
    ORDER BY "rank" ASC`);

    await this.cacheManager.set(
      CURRENT_LEADERBOARD_CACHE_KEY,
      leaderboard,
      FIVE_MINUTES_IN_MS,
    );

    return leaderboard;
  }

  async getLeaderboardWithRankHistory(): Promise<RankWithHistoryResponse[]> {
    this.logger.log('Get leaderboard with rank history');

    const cachedData = await this.cacheManager.get(
      CURRENT_RANK_HISTORY_CACHE_KEY,
    );

    if (cachedData) {
      this.logger.debug(
        'Serving current leaderboard data with rank history from cache',
      );
      return cachedData as Array<RankWithHistoryResponse>;
    }

    const rows = await db.all<RankWithHistoryDB>(sql`
      WITH latest AS (
        SELECT
          "userName",
          "score",
          "rank",
          "updatedAtTimestamp",
          ROW_NUMBER() OVER (
            PARTITION BY "userName"
            ORDER BY "updatedAtTimestamp" DESC
          ) AS rn
        FROM "score_updates"
      ),
      history AS (
        SELECT
          "userName",
          /* Build DESC-sorted JSON array of per-user events */
          json_group_array(
            json_object(
              'rank', "rank",
              'score', "score",
              'lastUpdated', strftime('%Y-%m-%dT%H:%M:%fZ', ("updatedAtTimestamp"/1000.0), 'unixepoch')
            )
            ORDER BY "updatedAtTimestamp" DESC
          ) AS "historyJson"
        FROM "score_updates"
        GROUP BY "userName"
      )
      SELECT
        l."userName"                 AS "userName",
        l."rank"                     AS "rank",
        l."score"                    AS "score",
        strftime('%Y-%m-%dT%H:%M:%fZ', (l."updatedAtTimestamp"/1000.0), 'unixepoch') AS "lastUpdated",
        h."historyJson"              AS "historyJson"
      FROM latest l
      JOIN history h USING ("userName")
      WHERE l.rn = 1
      ORDER BY l."rank" ASC
  `);

    const formattedData = rows.map((r) => ({
      userName: r.userName,
      rank: r.rank,
      score: r.score,
      lastUpdated: r.lastUpdated,
      history: JSON.parse(r.historyJson) as Array<
        Omit<RankItemResponse, 'userName'>
      >,
    }));

    await this.cacheManager.set(
      CURRENT_RANK_HISTORY_CACHE_KEY,
      formattedData,
      FIVE_MINUTES_IN_MS,
    );

    return formattedData;
  }

  async getUserRankHistory(userName: string): Promise<UserHistoryResponse> {
    this.logger.log(`Get rank history for userName=${userName}`);

    const cacheKey = `${CURRENT_RANK_HISTORY_CACHE_KEY}:${userName}`;
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      this.logger.debug('Serving rank history from cache');
      return cachedData as UserHistoryResponse;
    }

    const result = await db
      .select()
      .from(schema.scoreUpdates)
      .where(eq(schema.scoreUpdates.userName, userName))
      .orderBy(desc(schema.scoreUpdates.updatedAtTimestamp));

    if (result.length) {
      const parsedRes = {
        userName,
        history: result.map((item) => ({
          userName: item.userName,
          score: item.score,
          rank: item.rank,
          lastUpdated: timestampToDateString(item.updatedAtTimestamp),
        })),
      };

      await this.cacheManager.set(cacheKey, parsedRes, FIVE_MINUTES_IN_MS);

      return parsedRes;
    } else {
      throw new BadRequestException('User not found');
    }
  }
}
