import { SourceScanRepository } from "../repositories/sourceScan.repository";
import { InterfaceScan, InterfaceSourceScan } from "../scan.type";
import { ScanRepository } from "../repositories/scan.repository";
import { QUEUES_CONSTANTS } from "../../queue/queue.constants";
import { Injectable, Logger } from "@nestjs/common";
import sourceRegistry from "../sources.registry";
import { LockService } from "./lock.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

interface InterfaceFindStatusNickname {
  sources: Record<string, InterfaceSourceScan>;
  scan: InterfaceScan;
}

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);
  private readonly sources = sourceRegistry;

  constructor(
    private readonly sourceScanRepository: SourceScanRepository,
    private readonly scanRepository: ScanRepository,
    private readonly lockService: LockService,

    @InjectQueue(QUEUES_CONSTANTS.SOURCES)
    private readonly sourcesQueue: Queue,
  ) {}

  public async scanNickname(nickname: string): Promise<void> {
    this.logger.debug(`Starting scan for "${nickname}".`);

    await this.lockService.withLock(`lock:scan:${nickname}`, 60 * 5, async () => {
      try {
        await this.ensurePendingScan(nickname);
        await this.enqueueSources(nickname);

        this.logger.debug(`Enqueued ${this.sources.length} source jobs for "${nickname}".`);
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
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async enqueueSources(nickname: string): Promise<void> {
    await this.sourcesQueue.addBulk(
      this.sources.map((source) => ({
        name: source.sourceId,
        data: { nickname },
      })),
    );
  }
}
