import { Inject, Injectable, Logger } from '@nestjs/common';
import { db, schema } from 'src/db';
import { gameApiClient } from './helpers/http';
import { parseRankItems } from './helpers/parse';
import { inArray, not, sql } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

import {
  CURRENT_OSRS_LEADERBOARD_CACHE_KEY,
  FIVE_MINUTES_IN_MS,
  SYNC_LEADERBOARD_CRON_NAME,
} from 'src/config';
import {
  RankItem,
  RankItemResponse,
  RankListResponse,
  RankWithHistoryResponse,
  RankWithHistoryDB,
} from 'src/shared/types';

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async fetchLatestLeaderboardData() {
    this.logger.log('Fetching leaderboard from OSRS API');

    const cachedData = await this.cacheManager.get(
      CURRENT_OSRS_LEADERBOARD_CACHE_KEY,
    );

    if (cachedData) {
      this.logger.debug('Serving OSRS leaderboard data from cache');
      return cachedData as Array<RankItem>;
    }

    const { data } = await gameApiClient.get<RankListResponse>(
      '/ranking.json',
      {
        params: {
          table: 0,
          category: 0,
          size: 50,
        },
      },
    );

    this.logger.debug(`Found scores= ${data?.length ?? 0}`);

    const parsedData = data.length ? parseRankItems(data) : null;

    await this.cacheManager.set(
      CURRENT_OSRS_LEADERBOARD_CACHE_KEY,
      parsedData,
      FIVE_MINUTES_IN_MS,
    );

    return parsedData;
  }

  async getCurrentLeaderboard() {
    this.logger.log('Get current leaderboard');

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
      FROM "score_update_events"
    )
    SELECT
      "userName",
      "score",
      "rank",
      strftime('%Y-%m-%dT%H:%M:%fZ', "updatedAtTimestamp" / 1000, 'unixepoch') AS "lastUpdated"
    FROM latest
    WHERE rn = 1
    ORDER BY "rank" ASC`);

    return leaderboard;
  }

  async syncRankingEvents() {
    this.logger.debug('Updating rakings');

    const leaderboardData = await this.fetchLatestLeaderboardData();

    if (!leaderboardData) {
      return;
    }

    const updatedAtTimestamp = Date.now();

    const currentUsersInLeaderboard = leaderboardData.map((i) => i.name);

    const result = await db.transaction(async (tx) => {
      // 1) Insert new snapshots; ignore duplicates (same userName+rank+score)
      const inserted = await tx
        .insert(schema.scoreUpdateEvents)
        .values(
          leaderboardData.map((item) => ({
            userName: item.name,
            rank: item.rank,
            score: item.score,
            updatedAtTimestamp,
          })),
        )
        /**
         * Assuming score can only go up. If score and rank are unchanged,
         * it avoids storing duplicated score events
         */
        .onConflictDoNothing({
          target: [
            schema.scoreUpdateEvents.userName,
            schema.scoreUpdateEvents.rank,
            schema.scoreUpdateEvents.score,
          ],
        })
        .returning();

      if (inserted.length === 0) {
        this.logger.debug('No new changes were detected in the leaderboard');
      }

      let removedLength = 0;

      // 2) Stop tracking users not present anymore (purge all their history)
      if (currentUsersInLeaderboard.length > 0) {
        const removed = await tx
          .delete(schema.scoreUpdateEvents)
          .where(
            not(
              inArray(
                schema.scoreUpdateEvents.userName,
                currentUsersInLeaderboard,
              ),
            ),
          )
          .returning();

        removedLength = removed.length;
      }

      return { inserted: inserted.length, removed: removedLength };
    });

    this.logger.debug(
      `Added ${result.inserted} rank events. Removed ${result.removed} from excluded users`,
    );

    return result;
  }

  async getLeaderboardWithHistory(): Promise<RankWithHistoryResponse[]> {
    this.logger.debug('Get leaderboard with rank history');

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
        FROM "score_update_events"
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
        FROM "score_update_events"
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

    return rows.map((r) => ({
      userName: r.userName,
      rank: r.rank,
      score: r.score,
      lastUpdated: r.lastUpdated,
      history: JSON.parse(r.historyJson) as Array<
        Omit<RankItemResponse, 'userName'>
      >,
    }));
  }

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: SYNC_LEADERBOARD_CRON_NAME,
  })
  async syncLeaderboard() {
    this.logger.log(`Executing cron task=${SYNC_LEADERBOARD_CRON_NAME}`);
    await this.syncRankingEvents();
  }
}
