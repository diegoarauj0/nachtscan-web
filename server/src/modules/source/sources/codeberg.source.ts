import { InterfaceBaseSource, SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CodebergSource implements InterfaceBaseSource {
  public readonly sourceId: SourceId.CodeBerg = SourceId.CodeBerg;
  public readonly sourceName: string = "Codeberg";
  public readonly site: string = "https://codeberg.org";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://codeberg.org/${nickname}`;

  constructor(private readonly configService: ConfigService) {}

  public onInit(): boolean {
    return true;
  }

  public async scan(nickname: string): Promise<{ status: "found" | "not_found" }> {
    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);

    const token = this.configService.get<string>("CODEBERG_TOKEN") || undefined;
    if (token !== undefined) headers.set("Authorization", `Bearer ${token}`);

    const url = `https://codeberg.org/api/v1/users/${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`Codeberg API request failed with status ${response.status}.`);
  }
}
