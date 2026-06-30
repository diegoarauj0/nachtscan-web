import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class DevToSource implements BaseSource {
  public readonly sourceName: SourcesName = "Dev.to";
  public readonly sourceId: SourcesId = "devto";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://dev.to/${nickname}`;

  constructor(private readonly apiKey: string | undefined) {}

  public onModuleInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/vnd.forem.api-v1+json");
    headers.set("User-Agent", USER_AGENT);

    if (this.apiKey !== undefined) headers.set("api-key", this.apiKey);

    const url = `https://dev.to/api/users/by_username?url=${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`Dev.to API request failed with status ${response.status}.`);
  }
}
