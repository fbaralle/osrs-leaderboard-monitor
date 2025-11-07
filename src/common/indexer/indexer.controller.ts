import { Controller, Post } from '@nestjs/common';
import { IndexerService } from './indexer.service';

@Controller()
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  /** Manual execution rank events synchronization */
  @Post('/update')
  async updateRankings() {
    return await this.indexerService.syncRankingEvents();
  }

  /** Manual execution rank events synchronization */
  // @Post('/test-retry')
  // async testRetry() {
  //   return await this.indexerService.testThrottleRetry();
  // }
}
