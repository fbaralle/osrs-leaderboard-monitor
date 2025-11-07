# 🏆 OSRS Leaderboard Monitor

Tracks the **Old School RuneScape – Ultimate Ironman** overall leaderboard (top 50) and exposes an API.

- **Indexer cron job** runs every 5 minutes:
  - Pulls the current top-50 from the OSRS endpoint.
  - Caches the raw result for 5 minutes (avoid hammering).
  - Inserts only **new rank/score snapshots**.
  - **Stops tracking** players who are no longer in the top-50 (purges their history).
- **Conflict avoidance:** a **UNIQUE index** on `(userName, rank, score)` plus `ON CONFLICT DO NOTHING` makes inserts idempotent.
- **Retry mechanism**: If cron execution fails, it retries 10 times with a 20 seconds delay between each execution.
- **API** provides:
  - Current leaderboard (latest snapshot per user).
  - Leaderboard with full history (or single user history).

## Tech

- **Runtime:** NestJS (HTTP, cron, DI), Bun
- **DB:** SQLite (via libSQL), Drizzle ORM + Drizzle Kit
- **Cache:** Nest Cache (in-memory)
- **Tests:** Vitest
- **Docker:** Bun base image, compose with a **migrator** and an **API** service, DB persisted via a bind-mounted volume

---

## How it works

1. **Fetch**: indexer calls the OSRS ranking API (`/ranking.json?table=0&category=0&size=50`), parses the list into `{ name, rank, score }[]`.
2. **Cache**: a 5-minute cache key serves repeated reads to minimize upstream calls.
3. **Insert new events**:
   - Writes rows: `{ userName, rank, score, updatedAtTimestamp }`.
   - Uses:
     ```sql
     UNIQUE (userName, rank, score)
     ```
     and Drizzle’s
     ```ts
     .onConflictDoNothing({ target: [userName, rank, score] })
     ```
     to skip duplicates (same combo already captured).
4. **Stop tracking dropped players**:
   - After successful insert, deletes **all history** for users not present in the newest top-50 set.
5. **API views**:
   - **/leaderboard** → latest row per user (sorted by last update desc).
   - **/rank-history** → either:
     - All users with **desc-sorted** histories, or
     - A single `userName` with desc-sorted history.

## 🧩 Initial Sync on Startup

When the application starts, the IndexerService automatically checks whether the database is empty.
If no records are found, it performs an initial synchronization with the official Old School RuneScape Ultimate Ironman leaderboard.

## Requirements

- **Node/Bun** locally
- **Docker** (for containerized run)
- **SQLite** file is persisted under `./data/osrs.db`

---

## Environment

For **local dev** (outside Docker):

```
# Install dependencies
npm install

# Initialize database
npm run db:init

# Run app in dev mode
npm run start:dev
```

For **Docker** (compose reads this, or you can hardcode in compose):

```
# Run app in Docker containers
npm run start:docker
```

> ⚠️ Docker Compose will auto-read a file named `.env` for **variable substitution**. If you keep a local `.env`, either rename it (e.g. `.env.local`) or hardcode the `DATABASE_URL` inside your compose to avoid accidental overrides.

---

## Scripts

```bash
# install deps
bun install

# build (Nest → dist + fix path aliases)
npm run build

# DB: (re)create local ./data, then push schema (idempotent)
npm run db:init

# DB schema migrate/push (manual)
npm run db:migration   # generate migrations from schema
npm run db:migrate    # apply generated migrations
npm run db:push       # push schema state (no custom migrations)

# dev mode (watches src/, runs with Bun)
npm run start:dev

# run the compiled app
npm run start:prod

# run with Docker (migrator + api, DB persisted in ./data)
npm run start:docker

# tests
npm test
npm run test:watch
npm run test:cov

```

## 📡 API

See [API_DOCS.md](API_DOCS.md) for full contract and examples.
