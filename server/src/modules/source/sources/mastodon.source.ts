import { LockService } from "@/modules/redis/services/lock.service";
import { InterfaceBaseSource, SourceId } from "../source.type";
import { REDIS_CLIENT } from "@/modules/redis/redis.constants";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { USER_AGENT } from "../sources.constants";
import { ConfigService } from "@nestjs/config";
import timers from "node:timers/promises";
import Redis from "ioredis";

interface InterfaceCredential {
  clientSecret: string;
  clientKey: string;
}

@Injectable()
export class MastodonSource implements InterfaceBaseSource {
  private readonly logger = new Logger(MastodonSource.name);

  public readonly sourceId: SourceId.Mastodon = SourceId.Mastodon;
  public readonly sourceName: string = "Mastodon";
  public readonly site: string = "https://mastodon.social";

  public readonly cacheExpiresInMs: number = 12 * 60 * 60 * 1000;

  private readonly ACCESS_TOKEN_CACHE_EXPIRES_TTL: number = 30 * 24 * 60 * 60;

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://mastodon.social/@${nickname}`;

  private accessToken: string | undefined;
  private accessTokenExpiresAt: number | undefined;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,

    private readonly lockService: LockService,
    private readonly configService: ConfigService,
  ) {}

  public async onInit(): Promise<boolean> {
    const clientKey = this.configService.get<string>("MASTODON_CLIENT_KEY") || undefined;
    const clientSecret = this.configService.get<string>("MASTODON_CLIENT_SECRET") || undefined;

    if (clientKey === undefined || clientSecret === undefined) {
      throw new Error("MASTODON_CLIENT_KEY or MASTODON_CLIENT_SECRET is not configured.");
    }

    let accessToken = await this.redis.get("mastodon:access_token");
    const accessTokenExpiresTTL = await this.redis.ttl("mastodon:access_token");

    if (accessToken !== null) {
      this.logger.log(`Loaded access token from Redis (expires in ${accessTokenExpiresTTL}s).`);

      this.accessToken = accessToken;
      this.accessTokenExpiresAt = Date.now() + accessTokenExpiresTTL * 1000;

      return true;
    }

    this.logger.log("No cached access token found. Authenticating with Mastodon API.");

    accessToken = await this.authenticate({
      clientSecret: clientSecret,
      clientKey: clientKey,
    });

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = Date.now() + this.ACCESS_TOKEN_CACHE_EXPIRES_TTL * 1000;

    await this.redis.set("mastodon:access_token", accessToken, "EX", this.ACCESS_TOKEN_CACHE_EXPIRES_TTL);

    this.logger.log(`Access token cached for ${this.ACCESS_TOKEN_CACHE_EXPIRES_TTL} seconds.`);

    return true;
  }

  public async scan(nickname: string, attempt: number = 0): Promise<{ status: "found" | "not_found" }> {
    if (this.isAccessTokenExpired()) {
      this.logger.log("Access token expired. Refreshing.");

      if (attempt > 10) throw new Error("Mastodon authenticate lock timeout.");

      const lockKey = "lock:mastodon:authenticate";

      const acquired = await this.lockService.acquire(lockKey, 90);

      if (acquired === false) {
        this.logger.debug("Authentication lock is held by another instance. Waiting...");

        await timers.setTimeout(2000);
        return this.scan(nickname, attempt + 1);
      }

      this.logger.debug("Authentication lock acquired.");

      try {
        const clientKey = this.configService.getOrThrow<string>("MASTODON_CLIENT_KEY");
        const clientSecret = this.configService.getOrThrow<string>("MASTODON_CLIENT_SECRET");

        const accessToken = await this.authenticate({
          clientSecret: clientSecret,
          clientKey: clientKey,
        });

        this.accessToken = accessToken;
        this.accessTokenExpiresAt = Date.now() + this.ACCESS_TOKEN_CACHE_EXPIRES_TTL * 1000;

        await this.redis.set("mastodon:access_token", accessToken, "EX", this.ACCESS_TOKEN_CACHE_EXPIRES_TTL);

        this.logger.log(
          `Access token refreshed successfully (cached for ${this.ACCESS_TOKEN_CACHE_EXPIRES_TTL} seconds).`,
        );
      } finally {
        this.logger.debug("Authentication lock released.");

        await this.lockService.release(lockKey);
      }
    }

    const headers = new Headers();

    headers.set("Accept", "application/json");
    headers.set("User-Agent", USER_AGENT);
    headers.set("Authorization", `Bearer ${this.accessToken}`);

    const url = new URL("https://mastodon.social/api/v1/accounts/lookup");

    url.searchParams.set("acct", nickname);

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`Mastodon API request failed with status ${response.status}.`);
  }

  private isAccessTokenExpired(): boolean {
    return (
      this.accessToken === undefined ||
      this.accessTokenExpiresAt === undefined ||
      this.accessTokenExpiresAt < Date.now()
    );
  }

  private async authenticate(credential: InterfaceCredential): Promise<string> {
    const headers = new Headers();

    headers.append("Content-Type", "application/json");
    headers.append("Accept", "application/json");
    headers.append("User-Agent", USER_AGENT);

    const response = await fetch("https://mastodon.social/oauth/token", {
      headers: headers,
      method: "POST",
      body: JSON.stringify({
        client_id: credential.clientKey,
        client_secret: credential.clientSecret,

        //const
        scope: "read",
        grant_type: "client_credentials",
        redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
      }),
    });

    if (response.status !== 200) throw new Error("Mastodon API request failed");

    const data = (await response.json()) as { access_token: string };

    return data.access_token;
  }
}
