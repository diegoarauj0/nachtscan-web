import { InterfaceBaseSource, SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class GitlabSource implements InterfaceBaseSource {
  public readonly sourceId: SourceId = SourceId.GitLab;
  public readonly sourceName: string = "Gitlab";
  public readonly site: string = "https://gitlab.com";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://gitlab.com/${nickname}`;

  constructor(private readonly configService: ConfigService) {}

  public onInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    const token = this.configService.get<string>("GITLAB_TOKEN") || undefined;
    if (token !== undefined) headers.set("Authorization", `Bearer ${token}`);

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
