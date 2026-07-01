import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InterfaceBaseSource, SourceId } from "./source.type";
import { MinecraftSource } from "./sources/minecraft.source";
import { BitbucketSource } from "./sources/bitbucket.source";
import { CodebergSource } from "./sources/codeberg.source";
import { MastodonSource } from "./sources/mastodon.source";
import { BlueskySource } from "./sources/bluesky.source";
import { GitlabSource } from "./sources/gitlab.source";
import { GithubSource } from "./sources/github.source";
import { DevToSource } from "./sources/devto.source";
import { SteamSource } from "./sources/steam.source";
import { OsuSource } from "./sources/osu.source";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SourcesRegistry implements OnModuleInit {
  private readonly sources = new Map<SourceId, InterfaceBaseSource>();
  private readonly logger = new Logger(SourcesRegistry.name);
  private readonly sourcesDeactivated = new Set<SourceId>();

  constructor(
    private readonly configService: ConfigService,

    private readonly bitbucketSource: BitbucketSource,
    private readonly minecraftSource: MinecraftSource,
    private readonly codebergSource: CodebergSource,
    private readonly mastodonSource: MastodonSource,
    private readonly blueskySource: BlueskySource,
    private readonly githubSource: GithubSource,
    private readonly gitlabSource: GitlabSource,
    private readonly devtoSource: DevToSource,
    private readonly steamSource: SteamSource,
    private readonly osuSource: OsuSource,
  ) {
    this.sources.set(this.bitbucketSource.sourceId, this.bitbucketSource);
    this.sources.set(this.minecraftSource.sourceId, this.minecraftSource);
    this.sources.set(this.codebergSource.sourceId, this.codebergSource);
    this.sources.set(this.mastodonSource.sourceId, this.mastodonSource);
    this.sources.set(this.blueskySource.sourceId, this.blueskySource);
    this.sources.set(this.githubSource.sourceId, this.githubSource);
    this.sources.set(this.gitlabSource.sourceId, this.gitlabSource);
    this.sources.set(this.devtoSource.sourceId, this.devtoSource);
    this.sources.set(this.steamSource.sourceId, this.steamSource);
    this.sources.set(this.osuSource.sourceId, this.osuSource);
  }

  public sourcesInArray(): InterfaceBaseSource[] {
    const sourcesInArray: InterfaceBaseSource[] = [];

    for (const source of this.sources.values()) {
      if (!this.sourcesDeactivated.has(source.sourceId)) {
        sourcesInArray.push(source);
      }
    }

    return sourcesInArray;
  }

  public sourcesAllInArray(): InterfaceBaseSource[] {
    const sourcesInArray: InterfaceBaseSource[] = [];

    for (const source of this.sources.values()) {
      sourcesInArray.push(source);
    }

    return sourcesInArray;
  }

  public get(sourceId: SourceId, includeDisabled = false): InterfaceBaseSource | null {
    const source = this.sources.get(sourceId);

    return !includeDisabled && this.sourcesDeactivated.has(sourceId) ? null : source || null;
  }

  public isDisabled(sourceId: SourceId): boolean {
    const source = this.sources.get(sourceId);

    return source === null ? false : this.sourcesDeactivated.has(sourceId);
  }

  public async onModuleInit(): Promise<void> {
    const enabledSources = new Set(this.configService.get<string>("ENABLED_SOURCES", "").split(","));

    for (const [sourceId, source] of this.sources) {
      this.logger.log(`Loading source ${sourceId}...`);

      if (!source.onInit) {
        this.logger.log(`Source ${sourceId} loaded successfully.`);
        continue;
      }

      if (!enabledSources.has(source.sourceId)) {
        this.logger.warn(`Source "${source.sourceId}" is disabled by configuration.`);
        this.sourcesDeactivated.add(source.sourceId);
        continue;
      }

      try {
        const result = await source.onInit();

        if (!result) {
          this.sourcesDeactivated.add(source.sourceId);
          this.logger.warn(`Source "${source.sourceId}" is unavailable and has been disabled.`);
        }

        this.logger.log(`Source ${sourceId} loaded successfully.`);
      } catch (error) {
        this.sourcesDeactivated.add(source.sourceId);

        this.logger.warn(
          `Source "${source.sourceId}" has been disabled: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }
}
