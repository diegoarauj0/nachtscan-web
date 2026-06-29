import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { QueueModule } from "./modules/queue/queue.module";
import { RedisModule } from "./modules/redis/redis.module";
import { ScanModule } from "./modules/scan/scan.module";
import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

const configModule = ConfigModule.forRoot({
  envFilePath: [".env", `.env.${process.env.NODE_ENV}`],
  isGlobal: true,
});

const throttler = ThrottlerModule.forRoot({
  throttlers: [{ limit: 20, ttl: 60000 }],
});

const throttlerGuardProvider = {
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
};

@Module({
  imports: [configModule, throttler, RedisModule, QueueModule, ScanModule],
  providers: [throttlerGuardProvider],
})
export class AppModule {}
