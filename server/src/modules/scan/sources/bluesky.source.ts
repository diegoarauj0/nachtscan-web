import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class BlueskySource implements BaseSource {
  public readonly sourceName: SourcesName = "Bluesky";
  public readonly sourceId: SourcesId = "bluesky";

  public readonly cacheExpiresInMs: number = 6 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://bsky.app/profile/${nickname}`;

  public onModuleInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    // Bluesky usernames (handles) don't include the leading "@" in the API.
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
