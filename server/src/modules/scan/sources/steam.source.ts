import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class SteamSource implements BaseSource {
  public readonly sourceName: SourcesName = "Steam";
  public readonly sourceId: SourcesId = "steam";

  public readonly cacheExpiresInMs: number = 6 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://steamcommunity.com/id/${nickname}`;

  constructor(private readonly apiKey: string | undefined) {}

  public onModuleInit(): boolean {
    return this.apiKey !== undefined;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");

    url.searchParams.set("key", this.apiKey as string);
    url.searchParams.set("vanityurl", nickname);

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status !== 200) throw new Error(`Steam API request failed with status ${response.status}.`);

    const body = (await response.json()) as { response: { success: number; steamid?: string } };

    if (body.response.success === 1) return { status: "found" };

    return { status: "not_found" };
  }
}
