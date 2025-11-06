import { Controller, Get, Post } from '@nestjs/common';
import { IndexerService } from './indexer.service';

@Controller()
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @Get('/leaderboard-osrs')
  async getLeaderboardOsrs() {
    return await this.indexerService.fetchLatestLeaderboardData();
  }

  @Post('/update')
  async updateRankings() {
    return await this.indexerService.syncRankingEvents();
  }
}
