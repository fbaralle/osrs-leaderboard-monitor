import { Controller, Get, Query } from '@nestjs/common';
import { ApiService } from './api.service';

@Controller()
export class ApiController {
  constructor(private readonly indexerService: ApiService) {}

  @Get('/leaderboard')
  async getLeaderboard() {
    return await this.indexerService.getCurrentLeaderboard();
  }

  @Get('/rank-history')
  async getLeaderboardWithHistory(@Query('userName') userName?: string) {
    if (userName) {
      return await this.indexerService.getUserRankHistory(userName);
    }
    return await this.indexerService.getLeaderboardWithRankHistory();
  }
}
