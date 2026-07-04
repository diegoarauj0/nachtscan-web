import { InterfaceBaseSource, SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";
import { Injectable } from "@nestjs/common";

@Injectable()
export class BlueskySource implements InterfaceBaseSource {
  public readonly sourceId: SourceId = SourceId.Bluesky;
  public readonly sourceName: string = "Bluesky";
  public readonly site: string = "https://bsky.app";

  public readonly cacheExpiresInMs: number = 6 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://bsky.app/profile/${nickname}`;

  public onInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    const handle = nickname.startsWith("@") ? nickname.slice(1) : nickname;

    const url = new URL("https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile");

    url.searchParams.set("actor", handle);

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 400) return { status: "not_found" };

    throw new Error(`Bluesky API request failed with status ${response.status}.`);
  }
}
