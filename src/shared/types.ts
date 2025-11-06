import { schema } from 'src/db';

export type RankItemOSRCApiResponse = {
  name: string;
  score: string;
  rank: string;
};

export type RankListResponse = Array<RankItemOSRCApiResponse>;

export type RankItem = {
  name: string;
  score: number;
  rank: number;
};

export type ScoreUpdateEventType = typeof schema.scoreUpdates.$inferSelect;

export type RankItemResponse = {
  userName: string;
  rank: number;
  score: number;
  lastUpdated: string;
};

export type UserHistoryResponse = {
  userName: string;
} & {
  history: Array<Omit<RankItemResponse, 'userName'>>;
};

export type RankWithHistoryDB = RankItemResponse & {
  historyJson: string;
};

export type RankWithHistoryResponse = RankItemResponse & {
  history: Array<Omit<RankItemResponse, 'userName'>>;
};
