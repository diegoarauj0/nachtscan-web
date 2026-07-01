jest.mock("node:timers/promises", () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

import { LockService } from "@/modules/redis/services/lock.service";
import { MastodonSource } from "./mastodon.source";
import { ConfigService } from "@nestjs/config";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";
import { Logger } from "@nestjs/common";
import Redis from "ioredis";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

const ACCESS_TOKEN_REDIS_KEY = "mastodon:access_token";
const AUTHENTICATE_LOCK_KEY = "lock:mastodon:authenticate";
const ACCESS_TOKEN_CACHE_EXPIRES_TTL = 30 * 24 * 60 * 60;

describe("MastodonSource", () => {
  const mockRedis = mockDeep<Redis>();
  const mockLockService = mockDeep<LockService>();
  const mockConfigService = mockDeep<ConfigService>();

  let mastodonSource: MastodonSource;
  let fetchSpy: jest.SpyInstance;

  const mockResponse = (status: number, body?: unknown) =>
    ({
      status,
      json: jest.fn().mockResolvedValue(body),
    }) as unknown as Response;

  const setValidAccessToken = () => {
    (mastodonSource as any).accessToken = "valid-token";
    (mastodonSource as any).accessTokenExpiresAt = Date.now() + 60 * 60 * 1000;
  };

  const mockConfigCredentials = () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === "MASTODON_CLIENT_KEY") return "client-key";
      if (key === "MASTODON_CLIENT_SECRET") return "client-secret";
      if (key === "MASTODON_AUTHORIZATION_CODE") return "auth-code";
      return undefined;
    });
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === "MASTODON_CLIENT_KEY") return "client-key";
      if (key === "MASTODON_CLIENT_SECRET") return "client-secret";
      throw new Error(`Missing config key "${key}".`);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mastodonSource = new MastodonSource(mockRedis, mockLockService, mockConfigService);
    fetchSpy = jest.spyOn(global, "fetch");

    mockRedis.ttl.mockResolvedValue(3600);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(mastodonSource.sourceId).toBe(SourceId.Mastodon);
      expect(mastodonSource.sourceName).toBe("Mastodon");
    });
  });

  describe("MastodonSource.profileUrl", () => {
    it("Deve gerar a URL do perfil do Mastodon corretamente.", () => {
      expect(mastodonSource.profileUrl("octocat")).toBe("https://mastodon.social/@octocat");
    });
  });

  describe("MastodonSource.onInit", () => {
    it("Deve lançar um erro quando MASTODON_CLIENT_KEY não estiver configurado.", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "MASTODON_CLIENT_SECRET") return "secret";
        return undefined;
      });

      await expect(mastodonSource.onInit()).rejects.toThrow(
        "MASTODON_CLIENT_KEY or MASTODON_CLIENT_SECRET is not configured.",
      );
    });

    it("Deve lançar um erro quando MASTODON_CLIENT_SECRET não estiver configurado.", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "MASTODON_CLIENT_KEY") return "key";
        return undefined;
      });

      await expect(mastodonSource.onInit()).rejects.toThrow(
        "MASTODON_CLIENT_KEY or MASTODON_CLIENT_SECRET is not configured.",
      );
    });

    it("Deve carregar o access token do Redis quando houver um token em cache.", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue("cached-token");
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await mastodonSource.onInit();

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(ACCESS_TOKEN_REDIS_KEY);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect((mastodonSource as any).accessToken).toBe("cached-token");
    });

    it("Deve usar o token do Redis mesmo quando o TTL retornado for zero ou negativo (diferente do OsuSource, que exige TTL > 0).", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue("cached-token");
      mockRedis.ttl.mockResolvedValue(-1);

      const result = await mastodonSource.onInit();

      expect(result).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("Deve autenticar via API quando não houver token em cache no Redis.", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue(null);
      fetchSpy.mockResolvedValue(mockResponse(200, { access_token: "new-token" }));

      const result = await mastodonSource.onInit();

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://mastodon.social/oauth/token",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        ACCESS_TOKEN_REDIS_KEY,
        "new-token",
        "EX",
        ACCESS_TOKEN_CACHE_EXPIRES_TTL,
      );
      expect((mastodonSource as any).accessToken).toBe("new-token");
    });

    it("Deve propagar o erro de 'authenticate' sem encapsulá-lo (diferente do OsuSource, que envolve a causa).", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue(null);
      fetchSpy.mockResolvedValue(mockResponse(500));

      await expect(mastodonSource.onInit()).rejects.toThrow("Mastodon API request failed");
    });
  });

  describe("MastodonSource.scan", () => {
    it("Deve retornar 'found' quando a API responder com 200.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(200));

      const result = await mastodonSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar 'not_found' quando a API responder com 404.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(404));

      const result = await mastodonSource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status inesperado.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(500));

      await expect(mastodonSource.scan("octocat")).rejects.toThrow("Mastodon API request failed with status 500.");
    });

    it("Deve chamar a API com a URL e query string corretas, e o header Authorization com o access token atual.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(200));

      await mastodonSource.scan("octocat");

      const [url, options] = fetchSpy.mock.calls[0] as [string, any];

      expect(url.toString()).toBe("https://mastodon.social/api/v1/accounts/lookup?acct=octocat");

      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBe("Bearer valid-token");
      expect(headers.get("Accept")).toBe("application/json");
    });

    it("Deve codificar o nickname na query string usando '+' para espaços (comportamento do URLSearchParams).", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(200));

      await mastodonSource.scan("octo cat");

      const [url] = fetchSpy.mock.calls[0] as [string];

      expect(url.toString()).toBe("https://mastodon.social/api/v1/accounts/lookup?acct=octo+cat");
    });

    it("Deve renovar o access token quando estiver expirado antes de escanear, usando o lock de autenticação.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValue(true);

      fetchSpy.mockImplementation((url: string) => {
        if (url.toString().includes("oauth/token")) {
          return Promise.resolve(mockResponse(200, { access_token: "refreshed-token" }));
        }
        return Promise.resolve(mockResponse(200));
      });

      const result = await mastodonSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
      expect(mockLockService.acquire).toHaveBeenCalledWith(AUTHENTICATE_LOCK_KEY, 90);
      expect(mockLockService.release).toHaveBeenCalledWith(AUTHENTICATE_LOCK_KEY);
      expect(mockRedis.set).toHaveBeenCalledWith(
        ACCESS_TOKEN_REDIS_KEY,
        "refreshed-token",
        "EX",
        ACCESS_TOKEN_CACHE_EXPIRES_TTL,
      );

      const scanCall = fetchSpy.mock.calls.find(([url]: [string]) => !url.toString().includes("oauth/token"));
      const headers = scanCall?.[1].headers as Headers;

      expect(headers.get("Authorization")).toBe("Bearer refreshed-token");
    });

    it("Deve aguardar e tentar novamente quando o lock de autenticação não for adquirido de imediato.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      fetchSpy.mockImplementation((url: string) => {
        if (url.toString().includes("oauth/token")) {
          return Promise.resolve(mockResponse(200, { access_token: "refreshed-token" }));
        }
        return Promise.resolve(mockResponse(200));
      });

      const result = await mastodonSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
      expect(mockLockService.acquire).toHaveBeenCalledTimes(2);
    });

    it("Deve lançar um erro de timeout quando exceder o número máximo de tentativas sem conseguir o lock.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValue(false);

      await expect(mastodonSource.scan("octocat")).rejects.toThrow("Mastodon authenticate lock timeout.");
      expect(mockLockService.acquire).toHaveBeenCalledTimes(11);
    });

    it("Deve liberar o lock mesmo quando a renovação do access token falhar.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValue(true);
      fetchSpy.mockResolvedValue(mockResponse(500));

      await expect(mastodonSource.scan("octocat")).rejects.toThrow("Mastodon API request failed");
      expect(mockLockService.release).toHaveBeenCalledWith(AUTHENTICATE_LOCK_KEY);
    });
  });
});
