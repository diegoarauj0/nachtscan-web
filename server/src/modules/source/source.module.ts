import { SourceScanRepository } from "./repositories/sourceScan.repository";
import { SourcesProcessor } from "./processors/sources.processor";
import { SourcesRegistry } from "./sources.registry";
import { RedisModule } from "../redis/redis.module";
import { Module } from "@nestjs/common";
import sources from "./sources/sources";

@Module({
  imports: [RedisModule],
  providers: [...sources, SourceScanRepository, SourcesProcessor, SourcesRegistry],
  exports: [SourceScanRepository, SourcesRegistry],
})
export class SourceModule {}
