import { SourceScanRepository } from "../../source/repositories/sourceScan.repository";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ScanRepository } from "../repositories/scan.repository";
import { LockService } from "../../redis/services/lock.service";
import { SourcesRegistry } from "../../source/sources.registry";
import { QUEUES_CONSTANTS } from "../../queue/queue.constants";
import { InterfaceSourceScan } from "../../source/source.type";
import { Job, Queue, QueueEvents } from "bullmq";
import { InterfaceScan } from "../scan.type";
import { InjectQueue } from "@nestjs/bullmq";

interface InterfaceFindStatusNickname {
  sources: Record<string, InterfaceSourceScan>;
  scan: InterfaceScan;
}

@Injectable()
export class ScanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanService.name);
  private readonly queueEvents = new QueueEvents(QUEUES_CONSTANTS.SOURCES);

  constructor(
    private readonly sourceScanRepository: SourceScanRepository,
    private readonly sourcesRegistry: SourcesRegistry,
    private readonly scanRepository: ScanRepository,
    private readonly lockService: LockService,

    @InjectQueue(QUEUES_CONSTANTS.SOURCES)
    private readonly sourcesQueue: Queue,
  ) {}

  public onModuleInit(): void {
    this.queueEvents.on("failed", ({ jobId }): void => {
      void Job.fromId<{ nickname: string }>(this.sourcesQueue, jobId).then((job) => {
        if (job?.data.nickname) void this.completeScanIfFinished(job?.data.nickname);
      });
    });

    this.queueEvents.on("completed", ({ jobId }): void => {
      void Job.fromId<{ nickname: string }>(this.sourcesQueue, jobId).then((job) => {
        if (job?.data.nickname) void this.completeScanIfFinished(job?.data.nickname);
      });
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }

  public async scanNickname(nickname: string): Promise<void> {
    this.logger.debug(`Starting scan for "${nickname}".`);

    await this.lockService.withLock(`lock:scan:${nickname}`, 60 * 5, async () => {
      const sourceLength = this.sourcesRegistry.sourcesInArray.length;

      try {
        await this.ensurePendingScan(nickname);
        await this.enqueueSources(nickname);

        this.logger.debug(`Enqueued ${sourceLength} source jobs for "${nickname}".`);
      } catch (error) {
        await this.updateToFailed(nickname, error);
      }
    });

    this.logger.debug(`Finished scan request for "${nickname}".`);
  }

  public async findStatusNickname(nickname: string): Promise<InterfaceFindStatusNickname | null> {
    const scan = await this.scanRepository.findScan(nickname);
    if (!scan) return null;

    const sources = await this.sourceScanRepository.findSourceScans(nickname);

    return { scan, sources };
  }

  private async ensurePendingScan(nickname: string): Promise<void> {
    const scan = await this.scanRepository.findScan(nickname);

    if (scan === null) {
      this.logger.debug(`Creating new scan for "${nickname}".`);

      await this.scanRepository.createPending(nickname);
      return;
    }

    if (scan.status === "pending") {
      this.logger.debug(`Scan "${nickname}" is already pending.`);
      return;
    }

    this.logger.debug(`Updating scan "${nickname}" from "${scan.status}" to "pending".`);

    await this.scanRepository.updateToPending(nickname);

    return;
  }

  private async updateToFailed(nickname: string, error: unknown): Promise<void> {
    this.logger.error(
      error instanceof Error ? error.message : "scan failed.",
      error instanceof Error ? error.stack : undefined,
    );

    try {
      await this.scanRepository.updateToFailed(nickname);

      this.logger.debug(`Updated scan "${nickname}" to "failed".`);
    } catch (saveError) {
      this.logger.error(
        saveError instanceof Error ? saveError.message : "failed to save failed scan.",
        saveError instanceof Error ? saveError.stack : undefined,
      );
    }
  }

  private async completeScanIfFinished(nickname: string, attempt: number = 0): Promise<void> {
    const lockKey = `lock:scan:${nickname}:progress`;

    const acquired = await this.lockService.acquire(lockKey, 90);

    if (attempt > 10) {
      this.logger.warn(`Scan completion check for "${nickname}" lock timeout..`);
      return;
    }

    if (acquired === false) {
      this.logger.debug(`Scan completion check for "${nickname}" is locked. Retrying.`);
      setTimeout(() => void this.completeScanIfFinished(nickname, attempt + 1), 1000);
      return;
    }

    try {
      const sources = await this.sourceScanRepository.findSourceScans(nickname);
      let complete = true;

      this.sourcesRegistry.sourcesInArray.forEach((source) => {
        const sourceId = source.sourceId;

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

  private async enqueueSources(nickname: string): Promise<void> {
    const sources = this.sourcesRegistry.sourcesInArray;

    await this.sourcesQueue.addBulk(
      sources.map(({ sourceId }) => ({
        name: sourceId,
        data: { nickname },
      })),
    );
  }
}
