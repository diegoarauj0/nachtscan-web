import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class OsuSource implements BaseSource {
  public readonly sourceName: SourcesName = "Osu!";
  public readonly sourceId: SourcesId = "osu";

  public readonly cacheExpiresInMs: number = 6 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://osu.ppy.sh/users/${nickname}`;

  private accessToken: string | undefined;

  constructor(
    private readonly clientId: string | undefined,
    private readonly clientSecret: string | undefined,
  ) {}

  public async onModuleInit(): Promise<boolean> {
    if (this.clientId === undefined || this.clientSecret === undefined) return false;

    try {
      const response = await fetch("https://osu.ppy.sh/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
          scope: "public",
        }),
      });

      if (response.status !== 200) return false;

      const body = (await response.json()) as { access_token: string };

      this.accessToken = body.access_token;

      return true;
    } catch {
      return false;
    }
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");
    headers.set("User-Agent", USER_AGENT);
    headers.set("Authorization", `Bearer ${this.accessToken}`);

    const url = `https://osu.ppy.sh/api/v2/users/${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`osu! API request failed with status ${response.status}.`);
  }
}
