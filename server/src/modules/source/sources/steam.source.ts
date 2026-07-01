import { InterfaceBaseSource, SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SteamSource implements InterfaceBaseSource {
  public readonly sourceId: SourceId.Steam = SourceId.Steam;
  public readonly sourceName: string = "Steam";

  public readonly cacheExpiresInMs: number = 6 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://steamcommunity.com/id/${nickname}`;

  constructor(private readonly configService: ConfigService) {}

  public onInit(): boolean {
    const token = this.configService.get<string>("STEAM_TOKEN") || undefined;

    return token !== undefined;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const token = this.configService.get<string>("STEAM_TOKEN");

    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");

    url.searchParams.set("key", token as string);
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
