# 📡 API Docs

Base URL (default): `http://localhost:3000`

## `GET /leaderboard`

Returns the **latest snapshot** for each currently tracked user, sorted by most recent update timestamp (desc).

### Response (200)

```json
[
  {
    "userName": "Wooooo91",
    "score": 3740653265,
    "rank": 1,
    "updatedAtTimestamp": 1762465746841,
    "lastUpdated": "2025-11-06T21:49:06.841Z"
  }
]
```

cURL

```bash
curl -s http://localhost:3000/leaderboard | jq .
```

## `GET /rank-history`

Returns:

All users with their history array (desc), sorted by current rank, or

A single userName’s current row with history if ?userName= is provided.

### Query Params

**userName (optional)**: exact RuneScape name (case-sensitive as stored)

```json
Response (200) — all users
[
  {
    "userName": "Wooooo91",
    "rank": 1,
    "score": 3740653265,
    "lastUpdated": "2025-11-06T21:49:06.841Z",
    "history": [
      { "rank": 1, "score": 3740653265, "lastUpdated": "2025-11-06T21:49:06.841Z" },
      { "rank": 1, "score": 3740204129, "lastUpdated": "2025-11-06T02:10:45.276Z" }
    ]
  }
]
```

```json
Response (200) — single user
{
  "userName": "Wooooo91",
  "rank": 1,
  "score": 3740653265,
  "updatedAtTimestamp": 1762465746841,
  "history": [
    { "rank": 1, "score": 3740653265, "updatedAtTimestamp": 1762465746841 },
    { "rank": 1, "score": 3740204129, "updatedAtTimestamp": 1762405845276 }
  ]
}
```

cURL

```bash
curl -s "http://localhost:3000/rank-history?userName=Wooooo91" | jq .
```

## `POST /udpate`

Forces the execution of the leaderboard changes syncronization, that gets latest ranks and pushes new changes to db, ignoring duplicates and removing users that are no longer in the top 50 leaderboard.

### Response (200)

```json
{
  "inserted": 7,
  "removed": 0
}
```

### Errors

```
500 on unexpected errors (DB connection / upstream failures).
```

Empty arrays for no data.
