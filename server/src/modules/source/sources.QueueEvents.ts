import { QUEUES_CONSTANTS } from "../queue/queue.constants";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { QueueEvents, type RedisClient } from "bullmq";
import { Inject, Injectable } from "@nestjs/common";

@Injectable()
export class SourcesQueueEvents extends QueueEvents {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
  ) {
    super(QUEUES_CONSTANTS.SOURCES, {
      connection: redis,
    });
  }
}
