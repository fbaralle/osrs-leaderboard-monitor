import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ApiController } from 'src/common/api/api.controller';
import { ApiService } from 'src/common/api/api.service';

const mockLeaderboard = [
  {
    userName: 'Wooooo91',
    score: 3740653265,
    rank: 1,
    updatedAtTimestamp: 1762465746841,
    lastUpdated: '2025-11-06T21:49:06.841Z',
  },
  {
    userName: 'Gibbed',
    score: 3246150884,
    rank: 2,
    updatedAtTimestamp: 1762465746841,
    lastUpdated: '2025-11-06T21:49:06.841Z',
  },
];

const mockHistoryAll = [
  {
    userName: 'Wooooo91',
    rank: 1,
    score: 3740653265,
    lastUpdated: '2025-11-06T21:49:06.841Z',
    history: [
      { rank: 1, score: 3740653265, lastUpdated: '2025-11-06T21:49:06.841Z' },
      { rank: 1, score: 3740204129, lastUpdated: '2025-11-06T02:10:45.276Z' },
    ],
  },
];

const mockHistorySingle = {
  userName: 'Wooooo91',
  rank: 1,
  score: 3740653265,
  updatedAtTimestamp: 1762465746841,
  history: [
    { rank: 1, score: 3740653265, updatedAtTimestamp: 1762465746841 },
    { rank: 1, score: 3740204129, updatedAtTimestamp: 1762405845276 },
  ],
};

const mockApiService = {
  getCurrentLeaderboard: vi.fn().mockResolvedValue(mockLeaderboard),
  getLeaderboardWithRankHistory: vi.fn().mockResolvedValue(mockHistoryAll),
  getUserRankHistory: vi.fn().mockResolvedValue(mockHistorySingle),
};

describe('API routes (e2e — minimal app)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [{ provide: ApiService, useValue: mockApiService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /leaderboard → returns current leaderboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/leaderboard')
      .expect(200);
    expect(res.body).toEqual(mockLeaderboard);
    expect(mockApiService.getCurrentLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('GET /rank-history → returns leaderboard with history (all users)', async () => {
    const res = await request(app.getHttpServer())
      .get('/rank-history')
      .expect(200);
    expect(res.body).toEqual(mockHistoryAll);
    expect(mockApiService.getLeaderboardWithRankHistory).toHaveBeenCalledTimes(
      1,
    );
  });

  it('GET /rank-history?userName=Wooooo91 → returns single user history', async () => {
    const res = await request(app.getHttpServer())
      .get('/rank-history?userName=Wooooo91')
      .expect(200);
    expect(res.body).toEqual(mockHistorySingle);
    expect(mockApiService.getUserRankHistory).toHaveBeenCalledWith('Wooooo91');
  });
});
