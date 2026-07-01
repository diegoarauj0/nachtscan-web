import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { QueueModule } from "./modules/queue/queue.module";
import { ScanModule } from "./modules/scan/scan.module";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Module } from "@nestjs/common";

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
  imports: [configModule, throttler, QueueModule, ScanModule],
  providers: [throttlerGuardProvider],
})
export class AppModule {}
