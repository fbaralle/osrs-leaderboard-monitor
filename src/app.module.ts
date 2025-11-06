import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IndexerModule } from './common/indexer/indexer.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from './common/api/api.module';

@Module({
  imports: [
    /** In a real production use case, the Indexer Module should be
     * an independent app running in a different execution environment,
     * probably using a more complex architecture like an ETL system, that
     * puts data in a queue, then collects messages from the queue and sends
     * them to the DB as they appear in the queue (including a retry mechanism).
     */
    IndexerModule,
    ApiModule,
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
