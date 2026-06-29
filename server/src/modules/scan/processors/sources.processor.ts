import { SourceScanRepository } from "../repositories/sourceScan.repository";
import { ScanRepository } from "../repositories/scan.repository";
import { BaseSource, InterfaceSourceScan } from "../scan.type";
import { QUEUES_CONSTANTS } from "../../queue/queue.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { LockService } from "../services/lock.service";
import { Logger, OnModuleInit } from "@nestjs/common";
import sourceRegistry from "../sources.registry";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";

@Processor(QUEUES_CONSTANTS.SOURCES)
export class ScanProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ScanProcessor.name);
  private readonly sources = new Map<string, BaseSource>(sourceRegistry.map((source) => [source.sourceId, source]));
  private readonly sourcesDeactivated = new Set<string>();

  constructor(
    private readonly sourceScanRepository: SourceScanRepository,
    private readonly scanRepository: ScanRepository,
    private readonly configService: ConfigService,
    private readonly lockService: LockService,
  ) {
    super();
  }

  public async onModuleInit(): Promise<void> {
    for (const source of sourceRegistry) {
      if (source.onModuleInit) {
        this.logger.log(`Loading source ${source.sourceId}...`);

        const activated = this.configService.get<string>("ENABLED_SOURCES", "").split(",").includes(source.sourceId);

        if (activated === false) {
          this.logger.warn(`Source "${source.sourceId}" is disabled by configuration.`);
          return;
        }

        try {
          const result = await source.onModuleInit();

          if (result !== true) {
            this.sourcesDeactivated.add(source.sourceId);
            this.logger.warn(`Source "${source.sourceId}" is unavailable and has been disabled.`);
          }
        } catch {
          this.logger.error(`Source "${source.sourceId}" failed to initialize and has been disabled.`);
        }
      }
    }
  }

  public async process(job: Job<{ nickname: string }>) {
    const nickname = job.data.nickname;

    this.logger.debug(`Processing source job "${job.name}" for "${nickname}".`);

    await this.lockService.withLock(`lock:scan:${job.data.nickname}:${job.name}`, 60 * 5, async () => {
      const sourceClass = this.sources.get(job.name);
      if (sourceClass === undefined) {
        this.logger.warn(`Source job "${job.name}" for "${nickname}" has no registered source.`);
        return;
      }

      const profileUrl = sourceClass.profileUrl(nickname);
      const sourceName = sourceClass.sourceName;
      const sourceId = sourceClass.sourceId;

      if (this.sourcesDeactivated.has(sourceId)) {
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

    await this.completeScanIfFinished(nickname);

    this.logger.debug(`Finished processing source job "${job.name}" for "${nickname}".`);
  }

  private async completeScanIfFinished(nickname: string): Promise<void> {
    const lockKey = `lock:scan:${nickname}:progress`;

    const acquired = await this.lockService.acquire(lockKey, 60 * 5);
    if (acquired === false) {
      this.logger.debug(`Scan completion check for "${nickname}" is locked. Retrying.`);
      setTimeout(() => void this.completeScanIfFinished(nickname), 1000);
      return;
    }

    try {
      const sources = await this.sourceScanRepository.findSourceScans(nickname);
      let complete = true;

      this.sources.forEach(({ sourceId }) => {
        if (sources[sourceId] === undefined || sources[sourceId].status === "pending") {
          complete = false;
        }
      });

      if (complete) {
        this.logger.debug(`All source scans for "${nickname}" are finished. Completing scan.`);
        await this.scanRepository.updateToComplete(nickname);
      }
    } finally {
      await this.lockService.release(lockKey);
    }
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

  private async executeScan(source: BaseSource, nickname: string) {
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
