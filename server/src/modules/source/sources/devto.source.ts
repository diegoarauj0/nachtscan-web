import { InterfaceBaseSource, SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DevToSource implements InterfaceBaseSource {
  public readonly sourceId: SourceId = SourceId.DevTo;
  public readonly sourceName: string = "Dev.to";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://dev.to/${nickname}`;

  constructor(private readonly configService: ConfigService) {}

  public onInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/vnd.forem.api-v1+json");
    headers.set("User-Agent", USER_AGENT);

    const token = this.configService.get<string>("DEVTO_TOKEN") || undefined;
    if (token !== undefined) headers.set("api-key", token);

    const url = `https://dev.to/api/users/by_username?url=${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`Dev.to API request failed with status ${response.status}.`);
  }
}
