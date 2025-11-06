import { RankItem, RankListResponse } from 'src/shared/types';

const parseFormattedInt = (value: string): number => {
  const clean = value.replace(/,/g, '');
  const num = parseInt(clean, 10);

  if (isNaN(num)) {
    throw new Error(`Invalid number: ${value}`);
  }

  return num;
};

export const parseRankItems = (list: RankListResponse): Array<RankItem> => {
  return list.map((userRankData) => ({
    name: userRankData.name,
    score: parseFormattedInt(userRankData.score),
    rank: parseFormattedInt(userRankData.rank),
  }));
};

export const timestampToDateString = (ts: number) => {
  return new Date(ts).toISOString();
};
