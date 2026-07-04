export enum SourceId {
  Minecraft = "minecraft",
  BitBucket = "bitbucket",
  CodeBerg = "codeberg",
  Mastodon = "mastodon",
  Bluesky = "bluesky",
  GitLab = "gitlab",
  GitHub = "github",
  DevTo = "devto",
  Steam = "steam",
  Osu = "osu",
}

export interface InterfaceBaseSource {
  readonly sourceId: SourceId;
  readonly sourceName: string;
  readonly site: string;

  readonly cacheExpiresInMs: number;
  readonly profileUrl: (nickname: string) => string;

  onInit?(): Promise<boolean | void> | boolean | void;

  scan(nickname: string): Promise<{ status: "found" | "not_found" }>;
}

export interface InterfaceSourceScan {
  sourceId: SourceId;
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
