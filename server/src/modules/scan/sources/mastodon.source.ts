import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class MastodonSource implements BaseSource {
  public readonly sourceName: SourcesName = "Mastodon";
  public readonly sourceId: SourcesId = "mastodon";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://mastodon.social/@${nickname}`;

  private accessToken: string | undefined;

  constructor(
    private readonly clientKey: string | undefined,
    private readonly clientSecret: string | undefined,
    private readonly authorizationCode: string | undefined,
  ) {}

  public async onModuleInit(): Promise<boolean> {
    if (this.clientKey === undefined || this.clientSecret === undefined || this.authorizationCode === undefined) {
      return false;
    }

    try {
      const body = new URLSearchParams();

      body.set("client_id", this.clientKey);
      body.set("client_secret", this.clientSecret);
      body.set("redirect_uri", "urn:ietf:wg:oauth:2.0:oob");
      body.set("grant_type", "authorization_code");
      body.set("code", this.authorizationCode);
      body.set("scope", "read");

      const response = await fetch("https://mastodon.social/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: body,
      });

      if (response.status !== 200) return false;

      const data = (await response.json()) as { access_token: string };

      this.accessToken = data.access_token;

      return true;
    } catch {
      return false;
    }
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);
    headers.set("Authorization", `Bearer ${this.accessToken}`);

    const url = new URL("https://mastodon.social/api/v1/accounts/lookup");

    url.searchParams.set("acct", nickname);

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`Mastodon API request failed with status ${response.status}.`);
  }
}
