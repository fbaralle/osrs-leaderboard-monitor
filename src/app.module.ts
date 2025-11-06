import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IndexerModule } from './common/indexer/indexer.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from './common/api/api.module';

@Module({
  imports: [
    IndexerModule,
    ApiModule,
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
