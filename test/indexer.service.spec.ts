import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

// Hoisted state for mocks (runs before module graph loads)
const H = vi.hoisted(() => {
  // a tiny transactional "session" you can control in tests
  const makeTx = () => {
    const tx = {
      __inserted: 0,
      __removed: 0,
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () =>
              Array.from({ length: tx.__inserted }, (_, i) => ({
                id: i + 1,
              })),
          }),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: async () =>
            Array.from({ length: tx.__removed }, (_, i) => ({ id: i + 1 })),
        }),
      }),
    };
    return tx;
  };

  return {
    tx: makeTx(),
    countRef: { value: 0 }, // for SELECT count(*)
  };
});

// Mocks (factories can only use hoisted values or local values)
vi.mock('src/common/indexer/helpers/http', () => ({
  gameApiClient: {
    get: vi.fn(),
  },
}));

vi.mock('src/common/indexer/helpers/parse', () => ({
  parseRankItems: (
    rows: Array<{ name: string; rank: string; score: string }>,
  ) =>
    rows.map((r) => ({
      name: r.name,
      rank: Number(r.rank),
      score: Number(r.score),
    })),
}));

vi.mock('src/db', () => {
  const schema = {
    scoreUpdates: {
      userName: { __brand: 'col' },
      rank: { __brand: 'col' },
      score: { __brand: 'col' },
      updatedAtTimestamp: { __brand: 'col' },
    },
  };

  return {
    schema,
    db: {
      transaction: async (fn: Promise<void>) => fn(H.tx),
      select: () => ({
        from: async () => [{ count: H.countRef.value }],
      }),
    },
  };
});

import { IndexerService } from 'src/common/indexer/indexer.service';
import { gameApiClient } from 'src/common/indexer/helpers/http';

describe('IndexerService (unit, vitest)', () => {
  let service: IndexerService;
  let cache: unknown;

  const makeCache = () => {
    const store = new Map<string, any>();
    return {
      get: vi.fn(async (k: string) => store.get(k)),
      set: vi.fn(async (k: string, v: any) => store.set(k, v)),
    };
  };

  const apiRows = [
    { name: 'A', rank: '1', score: '10' },
    { name: 'B', rank: '2', score: '20' },
    { name: 'C', rank: '3', score: '30' },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // reset hoisted DB state before each test
    H.countRef.value = 0;
    H.tx.__inserted = 0;
    H.tx.__removed = 0;

    cache = makeCache();

    const moduleRef = await Test.createTestingModule({
      providers: [IndexerService, { provide: CACHE_MANAGER, useValue: cache }],
    }).compile();

    service = moduleRef.get(IndexerService);
  });

  it('syncRankingEvents: inserts new snapshots and removes dropped users', async () => {
    gameApiClient.get.mockResolvedValueOnce({ data: apiRows });

    H.tx.__inserted = 2;
    H.tx.__removed = 1;

    const res = await service.syncRankingEvents();
    expect(res).toEqual({ inserted: 2, removed: 1 });
  });

  it('onModuleInit: seeds when DB is empty, skips when not', async () => {
    // empty -> should seed
    H.countRef.value = 0;
    const seedSpy = vi
      .spyOn(service, 'syncRankingEvents')
      .mockResolvedValue({ inserted: 2, removed: 0 });
    await service.onModuleInit();
    expect(seedSpy).toHaveBeenCalledTimes(1);

    // not empty -> no seed
    seedSpy.mockReset();
    H.countRef.value = 5;
    await service.onModuleInit();
    expect(seedSpy).not.toHaveBeenCalled();
  });
});
