import { Inject, Injectable, Logger } from "@nestjs/common";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { InterfaceScan } from "../scan.type";
import Redis from "ioredis";

@Injectable()
export class ScanRepository {
  private readonly SCAN_TTL: number = 24 * 60 * 60;

  private readonly logger = new Logger(ScanRepository.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  public async createPending(nickname: string): Promise<InterfaceScan> {
    this.logger.debug(`Creating pending scan for "${nickname}".`);

    const scanKey = this.scanKey(nickname);

    const scan = this.createPendingScan(nickname);

    const result = await this.redis.set(scanKey, JSON.stringify(scan), "EX", this.SCAN_TTL, "NX");

    if (result === null) throw new Error(`Failed to create scan for "${nickname}".`);

    this.logger.debug(`Created pending scan for "${nickname}".`);

    return scan;
  }

  public async updateToPending(nickname: string): Promise<InterfaceScan> {
    this.logger.debug(`Updating scan for "${nickname}" to "pending".`);

    const scan = await this.findScan(nickname);

    if (scan === null) throw new Error(`Scan for "${nickname}" not found.`);

    scan.status = "pending";
    scan.startedAt = new Date().toUTCString();
    scan.completedAt = null;

    const scanKey = this.scanKey(nickname);
    const result = await this.redis.set(scanKey, JSON.stringify(scan), "EX", 10 * 60);

    if (result === null) throw new Error(`Failed to update scan for "${nickname}".`);

    this.logger.debug(`Updated scan for "${nickname}" to "pending".`);

    return scan;
  }

  public async updateToComplete(nickname: string): Promise<InterfaceScan> {
    this.logger.debug(`Updating scan for "${nickname}" to "completed".`);

    const scan = await this.findScan(nickname);

    if (scan === null) throw new Error(`Scan for "${nickname}" not found.`);

    scan.status = "completed";
    scan.completedAt = new Date().toUTCString();

    const scanKey = this.scanKey(nickname);
    const result = await this.redis.set(scanKey, JSON.stringify(scan), "EX", this.SCAN_TTL);

    if (result === null) throw new Error(`Failed to update scan for "${nickname}".`);

    this.logger.debug(`Updated scan for "${nickname}" to "completed".`);

    return scan;
  }

  public async updateToFailed(nickname: string): Promise<InterfaceScan> {
    this.logger.debug(`Updating scan for "${nickname}" to "failed".`);

    const scan = await this.findScan(nickname);

    if (scan === null) throw new Error(`Scan for "${nickname}" not found.`);

    scan.status = "failed";
    scan.completedAt = new Date().toUTCString();

    const scanKey = this.scanKey(nickname);
    const result = await this.redis.set(scanKey, JSON.stringify(scan), "EX", this.SCAN_TTL);

    if (result === null) throw new Error(`Failed to update scan for "${nickname}".`);

    this.logger.debug(`Updated scan for "${nickname}" to "failed".`);

    return scan;
  }

  public async findScan(nickname: string): Promise<InterfaceScan | null> {
    const stringify = await this.redis.get(this.scanKey(nickname));

    if (stringify === null) return null;

    return JSON.parse(stringify) as InterfaceScan;
  }

  private scanKey(nickname: string): string {
    return `scan:${nickname}`;
  }

  private createPendingScan(nickname: string): InterfaceScan {
    return {
      createdAt: new Date().toUTCString(),
      startedAt: new Date().toUTCString(),
      nickname: nickname,
      completedAt: null,
      status: "pending",
    };
  }
}
