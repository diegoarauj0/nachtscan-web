import { SourceScanRepository } from "../source/repositories/sourceScan.repository";
import { SourcesProcessor } from "../source/processors/sources.processor";
import { ScanRepository } from "./repositories/scan.repository";
import { ScanController } from "./controllers/scan.controller";
import { LockService } from "../redis/services/lock.service";
import { QUEUES_CONSTANTS } from "../queue/queue.constants";
import { SourceModule } from "../source/source.module";
import { ScanService } from "./services/scan.service";
import { RedisModule } from "../redis/redis.module";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES_CONSTANTS.SOURCES }), RedisModule, SourceModule],
  controllers: [ScanController],
  providers: [ScanService, ScanRepository, SourcesProcessor, SourceScanRepository, LockService],
})
export class ScanModule {}
