import { Inject, Injectable, Logger } from '@nestjs/common';
import { db, schema } from 'src/db';
import { gameApiClient } from './helpers/http';
import { parseRankItems } from './helpers/parse';
import { inArray, not, sql } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { retry } from 'ts-retry-promise';
import {
  CURRENT_OSRS_LEADERBOARD_CACHE_KEY,
  FIVE_MINUTES_IN_MS,
  PROMISE_MAX_RETRIES,
  PROMISE_RETRY_DELAY_MS,
  PROMISE_RETRY_TIMEOUT,
  SYNC_LEADERBOARD_CRON_NAME,
} from 'src/config';
import { RankItem, RankListResponse } from 'src/shared/types';

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Runs on app startup — if DB is empty, perform an initial sync.
   */
  async onModuleInit() {
    try {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.scoreUpdates);

      if (count === 0) {
        this.logger.log(
          'Database is empty. Performing initial leaderboard sync...',
        );
        await this.syncRankingEvents();
        this.logger.log('Initial leaderboard sync completed.');
      } else {
        this.logger.log(
          `Database already has ${count} records — skipping initial seed.`,
        );
      }
    } catch (err) {
      this.logger.error('Error while checking or seeding the database', err);
    }
  }

  private async promiseWithRetry<T>(fn: () => T | Promise<T>): Promise<T> {
    return retry(() => fn() as Promise<T>, {
      retries: PROMISE_MAX_RETRIES,
      delay: PROMISE_RETRY_DELAY_MS,
      timeout: PROMISE_RETRY_TIMEOUT,
      logger: (msg) =>
        this.logger.debug(
          `ERROR: ${msg}. Retrying in ${PROMISE_RETRY_DELAY_MS / 1000} secs.`,
        ),
    });
  }

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

  async syncRankingEvents() {
    this.logger.debug('Updating rakings');

    const leaderboardData = await this.fetchLatestLeaderboardData();

    if (!leaderboardData) {
      this.logger.debug('No scores found');
      return;
    }

    this.logger.debug('Saving scores to db');

    const updatedAtTimestamp = Date.now();

    const currentUsersInLeaderboard = leaderboardData.map((i) => i.name);

    const result = await db.transaction(async (tx) => {
      // 1) Insert new snapshots; ignore duplicates (same userName+rank+score)
      const inserted = await tx
        .insert(schema.scoreUpdates)
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
            schema.scoreUpdates.userName,
            schema.scoreUpdates.rank,
            schema.scoreUpdates.score,
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
          .delete(schema.scoreUpdates)
          .where(
            not(
              inArray(schema.scoreUpdates.userName, currentUsersInLeaderboard),
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

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: SYNC_LEADERBOARD_CRON_NAME,
  })
  async syncLeaderboard() {
    this.logger.log(`Executing cron task=${SYNC_LEADERBOARD_CRON_NAME}`);

    try {
      await this.promiseWithRetry(() => this.syncRankingEvents());
    } catch (e) {
      this.logger.log(`Failed task=${SYNC_LEADERBOARD_CRON_NAME}. ERROR: ${e}`);
    }
  }
}
