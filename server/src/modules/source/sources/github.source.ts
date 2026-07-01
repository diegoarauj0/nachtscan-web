import { InterfaceBaseSource, SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class GithubSource implements InterfaceBaseSource {
  public readonly sourceId: SourceId = SourceId.GitHub;
  public readonly sourceName: string = "Github";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://github.com/${nickname}`;

  constructor(private readonly configService: ConfigService) {}

  public onInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    const token = this.configService.get<string>("GITHUB_TOKEN") || undefined;
    if (token !== undefined) headers.set("Authorization", `Bearer ${token}`);

    const url = `https://api.github.com/users/${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`GitHub API request failed with status ${response.status}.`);
  }
}
