import { SourceScanRepository } from "./repositories/sourceScan.repository";
import { ScanRepository } from "./repositories/scan.repository";
import { QUEUES_CONSTANTS } from "../queue/queue.constants";
import { ScanService } from "./services/scan.service";
import { LockService } from "./services/lock.service";
import { ScanProcessor } from "./processors/sources.processor";
import { RedisModule } from "../redis/redis.module";
import { ScanController } from "./controllers/scan.controller";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES_CONSTANTS.SOURCES }), RedisModule],
  controllers: [ScanController],
  providers: [ScanService, ScanRepository, ScanProcessor, SourceScanRepository, LockService],
})
export class ScanModule {}
