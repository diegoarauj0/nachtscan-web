export type ScanStatusType = "pending" | "completed" | "failed";

export interface InterfaceSourceScan {
  sourceId: string;
  sourceName: string;
  site: string;

  status: "pending" | "found" | "not_found" | "failed";

  profileUrl: string;

  cached: boolean;
  cachedAt: string | null;
  cacheExpiresAt: string | null;

  createdAt: string;
  startedAt: string;
  completedAt: string | null;

  error: string | null;
}

export interface InterfaceScan {
  nickname: string;
  status: ScanStatusType;

  createdAt: string;
  startedAt: string;
  completedAt: string | null;
}
