import { uniqueIndex } from 'drizzle-orm/sqlite-core';
import { index } from 'drizzle-orm/sqlite-core';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const scoreUpdates = sqliteTable(
  'score_updates',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userName: text().notNull(),
    score: integer().notNull(),
    rank: integer().notNull(),
    updatedAtTimestamp: integer().notNull(),
  },
  (table) => [
    index('idx_username').on(table.userName),
    uniqueIndex('idx_unique_user_rank_score').on(
      table.userName,
      table.rank,
      table.score,
    ),
  ],
);
