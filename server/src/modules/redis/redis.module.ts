import { ConfigModule, ConfigService } from "@nestjs/config";
import { REDIS_CLIENT } from "./redis.constants";
import { Module } from "@nestjs/common";
import Redis from "ioredis";

const redisModule = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return new Redis({
      username: configService.get("REDIS_USERNAME"),
      password: configService.get("REDIS_PASSWORD"),
      host: configService.get("REDIS_HOST"),
      port: configService.get("REDIS_PORT"),
    });
  },
};

@Module({
  providers: [redisModule],
  imports: [ConfigModule],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
