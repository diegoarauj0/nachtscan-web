import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class BitbucketSource implements BaseSource {
  public readonly sourceName: SourcesName = "Bitbucket";
  public readonly sourceId: SourcesId = "bitbucket";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://bitbucket.org/${nickname}`;

  constructor(private readonly token: string | undefined) {}

  public onModuleInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    if (this.token !== undefined) headers.set("Authorization", `Bearer ${this.token}`);

    const url = `https://api.bitbucket.org/2.0/users/${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`Bitbucket API request failed with status ${response.status}.`);
  }
}
