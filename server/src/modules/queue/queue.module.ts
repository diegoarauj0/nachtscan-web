import { ConfigModule, ConfigService } from "@nestjs/config";
import { QUEUES_CONSTANTS } from "./queue.constants";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

const bullmqModule = BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    connection: {
      username: configService.get("redis.username"),
      password: configService.get("redis.password"),
      host: configService.get("redis.host"),
      port: configService.get("redis.port"),
    },
    defaultJobOptions: {
      attempts: QUEUES_CONSTANTS.DEFAULT.ATTEMPTS,
      removeOnComplete: QUEUES_CONSTANTS.DEFAULT.REMOVE_ON_COMPLETE,
      removeOnFail: QUEUES_CONSTANTS.DEFAULT.REMOVE_ON_FAIL,
    },
  }),
});

@Module({
  imports: [bullmqModule],
  exports: [BullModule],
})
export class QueueModule {}
