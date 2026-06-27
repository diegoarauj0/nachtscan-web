import { QueueModule } from "./modules/queue/queue.module";
import { RedisModule } from "./modules/redis/redis.module";
import { ScanModule } from "./modules/scan/scan.module";
import appConfig from "./modules/config/app.config";
import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";

const configModule = ConfigModule.forRoot({
  envFilePath: [".env", `.env.${process.env.NODE_MODULE}`],
  load: [appConfig],
  isGlobal: true,
});

@Module({
  imports: [configModule, RedisModule, QueueModule, ScanModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
