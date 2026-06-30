import { BaseSource, SourcesId, SourcesName } from "../scan.type";
import { USER_AGENT } from "../sources.constants";

export class GitlabSource implements BaseSource {
  public readonly sourceName: SourcesName = "Gitlab";
  public readonly sourceId: SourcesId = "gitlab";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://gitlab.com/${nickname}`;

  constructor(private readonly token: string | undefined) {}

  public onModuleInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    if (this.token !== undefined) headers.set("Authorization", `Bearer ${this.token}`);

    const url = `https://gitlab.com/api/v4/users?username=${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status !== 200) {
      throw new Error(`GitLab API request failed with status ${response.status}.`);
    }

    const users = (await response.json()) as Array<unknown>;

    if (users.length > 0) return { status: "found" };

    return { status: "not_found" };
  }
}
