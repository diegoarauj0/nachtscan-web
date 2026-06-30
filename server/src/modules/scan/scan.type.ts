export type ScanStatusType = "pending" | "completed" | "failed";
export type SourcesName =
  "Github" | "Gitlab" | "Bitbucket" | "Codeberg" | "Dev.to" | "Steam" | "Osu!" | "Minecraft" | "Mastodon" | "Bluesky";
export type SourcesId =
  "github" | "gitlab" | "bitbucket" | "codeberg" | "devto" | "steam" | "osu" | "minecraft" | "mastodon" | "bluesky";

export interface InterfaceSourceScan {
  sourceId: string;
  sourceName: string;

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

export interface BaseSource {
  readonly sourceId: SourcesId;
  readonly cacheExpiresInMs: number;
  readonly sourceName: SourcesName;
  readonly profileUrl: (nickname: string) => string;

  onModuleInit?(): Promise<boolean | void> | boolean | void;

  scan(nickname: string): Promise<{ status: "found" | "not_found" }>;
}
