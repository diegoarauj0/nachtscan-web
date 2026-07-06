import { REDIS_CLIENT } from "../redis/redis.constants";
import { QUEUES_CONSTANTS } from "./queue.constants";
import { RedisModule } from "../redis/redis.module";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { RedisClient } from "bullmq";

const bullmqModule = BullModule.forRootAsync({
  imports: [RedisModule],
  inject: [REDIS_CLIENT],
  useFactory: (redis: RedisClient) => ({
    connection: redis,
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
