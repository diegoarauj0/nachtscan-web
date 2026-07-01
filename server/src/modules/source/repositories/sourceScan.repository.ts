import { InterfaceSourceScan, SourceId } from "../source.type";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { SourcesRegistry } from "../sources.registry";
import Redis from "ioredis";

interface InterfaceCreatePendingProps {
  profileUrl: string;
  sourceName: string;
  sourceId: SourceId;
  nickname: string;
}

interface InterfaceUpdateToCompletedProps {
  cacheExpiresInMs: number;
  sourceId: SourceId;
  nickname: string;
  found: boolean;
}

interface InterfaceUpdateToFailedProps {
  sourceId: SourceId;
  nickname: string;
  error: string;
}

@Injectable()
export class SourceScanRepository {
  private readonly SOURCE_SCAN_TTL: number = 24 * 60 * 60;
  private readonly logger = new Logger(SourceScanRepository.name);

  constructor(
    private readonly sourcesRegistry: SourcesRegistry,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  public async findSourceScan(nickname: string, sourceId: SourceId): Promise<InterfaceSourceScan | null> {
    const sourceScanKey = this.sourceScanKey(nickname, sourceId);

    const stringify = await this.redis.get(sourceScanKey);
    if (stringify === null) return null;

    return JSON.parse(stringify) as InterfaceSourceScan;
  }

  public async findSourceScans(nickname: string): Promise<Record<string, InterfaceSourceScan>> {
    const sources: Partial<Record<SourceId, InterfaceSourceScan>> = {};
    const sourceIds = this.sourcesRegistry.sourcesInArray();

    for (const { sourceId } of sourceIds) {
      const sourceScanKey = this.sourceScanKey(nickname, sourceId);

      const stringify = await this.redis.get(sourceScanKey);
      if (stringify === null) continue;

      const sourceScan = JSON.parse(stringify) as InterfaceSourceScan;

      sources[sourceId] = sourceScan;
    }

    return sources;
  }

  public async createPending(props: InterfaceCreatePendingProps): Promise<InterfaceSourceScan> {
    const { nickname, profileUrl, sourceId, sourceName } = props;

    this.logger.debug(`Creating pending source scan "${sourceId}" for "${nickname}".`);

    const sourceScan = this.createPendingSourceScan(sourceId, sourceName, profileUrl);
    const sourceScanKey = this.sourceScanKey(nickname, sourceId);

    const result = await this.redis.set(sourceScanKey, JSON.stringify(sourceScan), "EX", this.SOURCE_SCAN_TTL, "NX");

    if (result === null) throw new Error("Failed to create source sourceScan.");

    this.logger.debug(`Created pending source scan "${sourceId}" for "${nickname}".`);

    return sourceScan;
  }

  public async updateToCompleted(props: InterfaceUpdateToCompletedProps): Promise<InterfaceSourceScan> {
    const { found, nickname, sourceId, cacheExpiresInMs } = props;

    this.logger.debug(`Updating source scan "${sourceId}" for "${nickname}" to "${found ? "found" : "not_found"}".`);

    const sourceScan = await this.findSourceScan(nickname, sourceId);

    if (sourceScan === null) throw new Error(`Source scan "${sourceId}" for "${nickname}" not found.`);

    const now = new Date();

    sourceScan.status = found ? "found" : "not_found";
    sourceScan.completedAt = now.toUTCString();
    sourceScan.error = null;

    sourceScan.cached = true;
    sourceScan.cachedAt = now.toUTCString();
    sourceScan.cacheExpiresAt = new Date(now.getTime() + cacheExpiresInMs).toUTCString();

    const sourceScanKey = this.sourceScanKey(nickname, sourceId);
    const result = await this.redis.set(sourceScanKey, JSON.stringify(sourceScan), "EX", this.SOURCE_SCAN_TTL);

    if (result === null) throw new Error("Failed to update sourceScan.");

    this.logger.debug(`Updated source scan "${sourceId}" for "${nickname}" to "${found ? "found" : "not_found"}".`);

    return sourceScan;
  }

  public async updateToFailed(props: InterfaceUpdateToFailedProps): Promise<InterfaceSourceScan> {
    const { error, nickname, sourceId } = props;

    this.logger.debug(`Updating source scan "${sourceId}" for "${nickname}" to "failed".`);

    const sourceScan = await this.findSourceScan(nickname, sourceId);

    if (sourceScan === null) throw new Error(`Source scan "${sourceId}" for "${nickname}" not found.`);

    const now = new Date();

    sourceScan.status = "failed";
    sourceScan.completedAt = now.toUTCString();
    sourceScan.error = error;

    sourceScan.cached = false;
    sourceScan.cachedAt = null;
    sourceScan.cacheExpiresAt = null;

    const sourceScanKey = this.sourceScanKey(nickname, sourceId);
    const result = await this.redis.set(sourceScanKey, JSON.stringify(sourceScan), "EX", this.SOURCE_SCAN_TTL);

    if (result === null) throw new Error("Failed to update sourceScan.");

    return sourceScan;
  }

  public async updateToPending(nickname: string, sourceId: SourceId): Promise<InterfaceSourceScan> {
    this.logger.debug(`Updating source scan "${sourceId}" for "${nickname}" to "pending".`);

    const sourceScan = await this.findSourceScan(nickname, sourceId);

    if (sourceScan === null) throw new Error(`Source scan "${sourceId}" for "${nickname}" not found.`);

    const now = new Date();

    sourceScan.status = "pending";
    sourceScan.startedAt = now.toUTCString();
    sourceScan.completedAt = null;

    const sourceScanKey = this.sourceScanKey(nickname, sourceId);
    const result = await this.redis.set(sourceScanKey, JSON.stringify(sourceScan), "EX", this.SOURCE_SCAN_TTL);

    if (result === null) throw new Error("Failed to update sourceScan.");

    return sourceScan;
  }

  private sourceScanKey(nickname: string, sourceId: SourceId): string {
    return `scan:${nickname}:${sourceId}`;
  }

  private createPendingSourceScan(sourceId: string, sourceName: string, profileUrl: string): InterfaceSourceScan {
    const now = new Date();

    return {
      sourceId: sourceId,
      sourceName: sourceName,
      status: "pending",
      cached: false,
      cachedAt: null,
      cacheExpiresAt: null,
      completedAt: null,
      createdAt: now.toUTCString(),
      error: null,
      profileUrl: profileUrl,
      startedAt: now.toUTCString(),
    };
  }
}
