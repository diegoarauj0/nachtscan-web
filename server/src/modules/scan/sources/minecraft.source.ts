import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class MinecraftSource implements BaseSource {
  public readonly sourceName: SourcesName = "Minecraft";
  public readonly sourceId: SourcesId = "minecraft";

  public readonly cacheExpiresInMs: number = 3 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://pt.namemc.com/profile/${nickname}`;

  public onModuleInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`Mojang API request failed with status ${response.status}.`);
  }
}
