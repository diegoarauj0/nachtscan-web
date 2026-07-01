import { InterfaceBaseSource, InterfaceSourceScan, SourceId } from "../source.type";
import { SourceScanRepository } from "../repositories/sourceScan.repository";
import { LockService } from "../../redis/services/lock.service";
import { QUEUES_CONSTANTS } from "../../queue/queue.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { SourcesRegistry } from "../sources.registry";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";

@Processor(QUEUES_CONSTANTS.SOURCES)
export class SourcesProcessor extends WorkerHost {
  private readonly logger = new Logger(SourcesProcessor.name);

  constructor(
    private readonly sourceScanRepository: SourceScanRepository,
    private readonly sourcesRegistry: SourcesRegistry,
    private readonly lockService: LockService,
  ) {
    super();
  }

  public async process(job: Job<{ nickname: string }>) {
    const nickname = job.data.nickname;
    const name = job.name as SourceId;

    this.logger.debug(`Processing source job "${name}" for "${nickname}".`);

    await this.lockService.withLock(`lock:scan:${job.data.nickname}:${name}`, 60 * 5, async () => {
      const sourceClass = this.sourcesRegistry.get(name);

      if (sourceClass === null) {
        this.logger.warn(`Source job "${job.name}" for "${nickname}" has not found.`);
        return;
      }

      const profileUrl = sourceClass.profileUrl(nickname);
      const sourceName = sourceClass.sourceName;
      const sourceId = sourceClass.sourceId;

      if (this.sourcesRegistry.isDisabled(sourceId)) {
        this.logger.debug(`Skipping source scan "${sourceId}" for "${nickname}" because the source is disabled.`);
        return;
      }

      let sourceScan = await this.sourceScanRepository.findSourceScan(nickname, sourceId);

      if (sourceScan !== null) {
        if (sourceScan.status === "pending") {
          this.logger.debug(`Source scan "${sourceId}" for "${nickname}" is already pending.`);
          return;
        }

        if (this.isCacheValid(sourceScan)) {
          this.logger.debug(`Skipping source scan "${sourceId}" for "${nickname}" because a valid cache entry exists.`);
          return;
        }

        sourceScan = await this.sourceScanRepository.updateToPending(nickname, sourceId);
      } else {
        sourceScan = await this.sourceScanRepository.createPending({
          profileUrl: profileUrl,
          sourceName: sourceName,
          nickname: nickname,
          sourceId: sourceId,
        });
      }

      await this.executeScan(sourceClass, nickname);
    });

    this.logger.debug(`Finished processing source job "${job.name}" for "${nickname}".`);
  }

  private isCacheValid(sourceScan: InterfaceSourceScan): boolean {
    const now = new Date();

    if (sourceScan.status !== "found" && sourceScan.status !== "not_found") {
      this.logger.debug("Cache invalid: status is not cacheable.");
      return false;
    }

    if (sourceScan.cacheExpiresAt === null) {
      this.logger.debug("Cache invalid: cacheExpiresAt is null.");
      return false;
    }

    return new Date(sourceScan.cacheExpiresAt) > now;
  }

  private async executeScan(source: InterfaceBaseSource, nickname: string) {
    try {
      this.logger.debug(`Executing source scan "${source.sourceId}" for "${nickname}".`);

      const result = await source.scan(nickname);

      await this.sourceScanRepository.updateToCompleted({
        cacheExpiresInMs: source.cacheExpiresInMs,
        found: result.status === "found",
        sourceId: source.sourceId,
        nickname,
      });

      this.logger.debug(`Executed source scan "${source.sourceId}" for "${nickname}" with status "${result.status}".`);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Source scan failed.",
        error instanceof Error ? error.stack : undefined,
      );

      await this.sourceScanRepository.updateToFailed({
        error: error instanceof Error ? error.message : "Source scan failed.",
        sourceId: source.sourceId,
        nickname: nickname,
      });
    }
  }
}
