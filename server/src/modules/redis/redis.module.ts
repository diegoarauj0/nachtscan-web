import { LockService } from "./services/lock.service";
import { REDIS_CLIENT } from "./redis.constants";
import { ConfigService } from "@nestjs/config";
import { Module } from "@nestjs/common";
import Redis from "ioredis";

const redisModule = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return new Redis({
      maxRetriesPerRequest: null,
      username: configService.get("REDIS_USERNAME"),
      password: configService.get("REDIS_PASSWORD"),
      host: configService.get("REDIS_HOST"),
      port: configService.get("REDIS_PORT"),
    });
  },
};

@Module({
  providers: [redisModule, LockService],
  exports: [REDIS_CLIENT, LockService],
})
export class RedisModule {}
