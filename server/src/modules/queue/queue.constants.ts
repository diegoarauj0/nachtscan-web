export const QUEUES_CONSTANTS = {
  SOURCES: "sources",

  DEFAULT: {
    ATTEMPTS: 3,
    REMOVE_ON_COMPLETE: 100,
    REMOVE_ON_FAIL: 1000,
  },
} as const;
