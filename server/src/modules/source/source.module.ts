import { SourceScanRepository } from "./repositories/sourceScan.repository";
import { SourcesProcessor } from "./processors/sources.processor";
import { SourcesQueueEvents } from "./sources.QueueEvents";
import { SourcesRegistry } from "./sources.registry";
import { RedisModule } from "../redis/redis.module";
import { Module } from "@nestjs/common";
import sources from "./sources/sources";

@Module({
  imports: [RedisModule],
  providers: [...sources, SourceScanRepository, SourcesProcessor, SourcesRegistry, SourcesQueueEvents],
  exports: [SourceScanRepository, SourcesRegistry, SourcesQueueEvents],
})
export class SourceModule {}
