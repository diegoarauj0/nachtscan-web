import { ConfigModule, ConfigService } from "@nestjs/config";
import { REDIS_CLIENT } from "./redis.constants";
import { Module } from "@nestjs/common";
import Redis from "ioredis";

const redisModule = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return new Redis({
      username: configService.get("redis.username"),
      password: configService.get("redis.password"),
      host: configService.get("redis.host"),
      port: configService.get("redis.port"),
    });
  },
};

@Module({
  providers: [redisModule],
  imports: [ConfigModule],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
