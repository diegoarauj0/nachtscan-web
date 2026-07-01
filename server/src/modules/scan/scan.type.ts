export type ScanStatusType = "pending" | "completed" | "failed";

export interface InterfaceScan {
  nickname: string;
  status: ScanStatusType;

  createdAt: string;
  startedAt: string;
  completedAt: string | null;
}
