CREATE TABLE `score_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userName` text NOT NULL,
	`score` integer NOT NULL,
	`rank` integer NOT NULL,
	`updatedAtTimestamp` integer NOT NULL
);

CREATE INDEX `idx_username` ON `score_updates` (`userName`);
CREATE UNIQUE INDEX `idx_unique_user_rank_score` ON `score_updates` (`userName`,`rank`,`score`);