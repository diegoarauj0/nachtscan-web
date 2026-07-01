import { Inject, Injectable } from "@nestjs/common";
import { REDIS_CLIENT } from "../redis.constants";
import Redis from "ioredis";

@Injectable()
export class LockService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  public async withLock<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T | undefined> {
    const acquired = await this.acquire(key, ttl);
    if (!acquired) return;

    try {
      return await callback();
    } finally {
      await this.release(key);
    }
  }

  public async acquire(key: string, ttl: number): Promise<boolean> {
    return (await this.redis.set(key, "1", "EX", ttl, "NX")) === "OK";
  }

  public async release(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
