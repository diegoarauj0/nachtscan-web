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
  clientId: string;
}

interface InterfaceAuthenticateResult {
  accessToken: string;
  expiresInSeconds: number;
}

@Injectable()
export class OsuSource implements InterfaceBaseSource {
  private readonly logger = new Logger(OsuSource.name);

  public readonly sourceId: SourceId = SourceId.Osu;
  public readonly sourceName: string = "Osu!";
  public readonly site: string = "https://osu.ppy.sh";

  public readonly cacheExpiresInMs: number = 6 * 60 * 60 * 1000;

  private readonly ACCESS_TOKEN_FALLBACK_TTL_SECONDS: number = 24 * 60 * 60;

  private readonly ACCESS_TOKEN_REDIS_KEY: string = "osu:access_token";
  private readonly AUTHENTICATE_LOCK_KEY: string = "lock:osu:authenticate";

  public readonly profileUrl: (nickname: string) => string = (nickname) => `https://osu.ppy.sh/users/${nickname}`;

  private accessToken: string | undefined;
  private accessTokenExpiresAt: number | undefined;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,

    private readonly lockService: LockService,
    private readonly configService: ConfigService,
  ) {}

  public async onInit(): Promise<boolean> {
    const clientId = this.configService.get<string>("OSU_CLIENT_ID") || undefined;
    const clientSecret = this.configService.get<string>("OSU_CLIENT_SECRET") || undefined;

    if (clientId === undefined || clientSecret === undefined) {
      throw new Error("OSU_CLIENT_ID or OSU_CLIENT_SECRET is not configured.");
    }

    const cachedAccessToken = await this.redis.get(this.ACCESS_TOKEN_REDIS_KEY);
    const cachedAccessTokenTTL = await this.redis.ttl(this.ACCESS_TOKEN_REDIS_KEY);

    if (cachedAccessToken !== null && cachedAccessTokenTTL > 0) {
      this.logger.log(`Loaded access token from Redis (expires in ${cachedAccessTokenTTL}s).`);

      this.accessToken = cachedAccessToken;
      this.accessTokenExpiresAt = Date.now() + cachedAccessTokenTTL * 1000;

      return true;
    }

    this.logger.log("No cached access token found. Authenticating with osu! API.");

    try {
      await this.refreshAccessToken({ clientId, clientSecret });
      return true;
    } catch (error) {
      throw new Error("Failed to authenticate during initialization.", { cause: error });
    }
  }

  public async scan(nickname: string, attempt: number = 0): Promise<{ status: "found" | "not_found" }> {
    if (this.isAccessTokenExpired()) {
      this.logger.log("Access token expired. Refreshing.");

      if (attempt > 10) throw new Error("osu! authenticate lock timeout.");

      const acquired = await this.lockService.acquire(this.AUTHENTICATE_LOCK_KEY, 90);

      if (acquired === false) {
        this.logger.debug("Authentication lock is held by another instance. Waiting...");

        await timers.setTimeout(2000);
        return this.scan(nickname, attempt + 1);
      }

      this.logger.debug("Authentication lock acquired.");

      try {
        const clientId = this.configService.getOrThrow<string>("OSU_CLIENT_ID");
        const clientSecret = this.configService.getOrThrow<string>("OSU_CLIENT_SECRET");

        await this.refreshAccessToken({ clientId, clientSecret });
      } finally {
        await this.lockService.release(this.AUTHENTICATE_LOCK_KEY);
        this.logger.debug("Authentication lock released.");
      }
    }

    const headers = new Headers();

    headers.set("User-Agent", USER_AGENT);
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${this.accessToken}`);

    const url = `https://osu.ppy.sh/api/v2/users/${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      headers: headers,
    });

    if (response.status === 200) return { status: "found" };
    if (response.status === 404) return { status: "not_found" };

    throw new Error(`osu! API request failed with status ${response.status}.`);
  }

  private isAccessTokenExpired(): boolean {
    return (
      this.accessToken === undefined ||
      this.accessTokenExpiresAt === undefined ||
      this.accessTokenExpiresAt <= Date.now()
    );
  }

  private async refreshAccessToken(credential: InterfaceCredential): Promise<void> {
    this.logger.log("Requesting a new access token.");

    const { accessToken, expiresInSeconds } = await this.authenticate(credential);

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = Date.now() + expiresInSeconds * 1000;

    await this.redis.set(this.ACCESS_TOKEN_REDIS_KEY, accessToken, "EX", expiresInSeconds);

    this.logger.log(`Access token refreshed successfully (expires in ${expiresInSeconds}s).`);
  }

  private async authenticate(credential: InterfaceCredential): Promise<InterfaceAuthenticateResult> {
    const headers = new Headers();

    headers.append("Content-Type", "application/json");
    headers.append("Accept", "application/json");
    headers.append("User-Agent", USER_AGENT);

    const response = await fetch("https://osu.ppy.sh/oauth/token", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        client_id: credential.clientId,
        client_secret: credential.clientSecret,

        grant_type: "client_credentials",
        scope: "public",
      }),
    });

    if (response.status !== 200) {
      throw new Error(`osu! OAuth token request failed with status ${response.status}.`);
    }

    const body = (await response.json()) as { access_token: string; expires_in?: number };

    return {
      accessToken: body.access_token,
      expiresInSeconds: body.expires_in ?? this.ACCESS_TOKEN_FALLBACK_TTL_SECONDS,
    };
  }
}
