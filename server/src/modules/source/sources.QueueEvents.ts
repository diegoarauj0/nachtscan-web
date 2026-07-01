import { QUEUES_CONSTANTS } from "../queue/queue.constants";
import { Injectable } from "@nestjs/common";
import { QueueEvents } from "bullmq";

@Injectable()
export class SourcesQueueEvents extends QueueEvents {
  constructor() {
    super(QUEUES_CONSTANTS.SOURCES);
  }
}
