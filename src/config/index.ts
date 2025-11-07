export const SYNC_LEADERBOARD_CRON_NAME = 'sync-leaderboard-cron';
export const CURRENT_OSRS_LEADERBOARD_CACHE_KEY = 'current-osrs-leaderboard';
export const CURRENT_LEADERBOARD_CACHE_KEY = 'current-leaderboard';
export const CURRENT_RANK_HISTORY_CACHE_KEY = 'current-rank-history';

export const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;

export const DEFAULT_DB_URL = 'file:./data/osrs.db';

export const PROMISE_RETRY_DELAY_MS = 10 * 1000;
export const PROMISE_MAX_RETRIES = 3;
export const PROMISE_RETRY_TIMEOUT =
  PROMISE_RETRY_DELAY_MS * PROMISE_MAX_RETRIES * 3;
