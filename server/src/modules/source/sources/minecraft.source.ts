import { InterfaceBaseSource, SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MinecraftSource implements InterfaceBaseSource {
  public readonly sourceId: SourceId = SourceId.Minecraft;
  public readonly sourceName: string = "Minecraft";
  public readonly site: string = "https://www.minecraft.net";

  public readonly cacheExpiresInMs: number = 3 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://pt.namemc.com/profile/${nickname}`;

  public onInit(): boolean {
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
