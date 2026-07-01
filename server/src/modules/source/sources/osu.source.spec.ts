jest.mock("node:timers/promises", () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

import { LockService } from "@/modules/redis/services/lock.service";
import { ConfigService } from "@nestjs/config";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";
import { OsuSource } from "./osu.source";
import { Logger } from "@nestjs/common";
import Redis from "ioredis";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

const ACCESS_TOKEN_REDIS_KEY = "osu:access_token";
const AUTHENTICATE_LOCK_KEY = "lock:osu:authenticate";

describe("OsuSource", () => {
  const mockRedis = mockDeep<Redis>();
  const mockLockService = mockDeep<LockService>();
  const mockConfigService = mockDeep<ConfigService>();

  let osuSource: OsuSource;
  let fetchSpy: jest.SpyInstance;

  const mockResponse = (status: number, body?: unknown) =>
    ({
      status,
      json: jest.fn().mockResolvedValue(body),
    }) as unknown as Response;

  const setValidAccessToken = () => {
    (osuSource as any).accessToken = "valid-token";
    (osuSource as any).accessTokenExpiresAt = Date.now() + 60 * 60 * 1000;
  };

  const mockConfigCredentials = () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === "OSU_CLIENT_ID") return "client-id";
      if (key === "OSU_CLIENT_SECRET") return "client-secret";
      return undefined;
    });
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === "OSU_CLIENT_ID") return "client-id";
      if (key === "OSU_CLIENT_SECRET") return "client-secret";
      throw new Error(`Missing config key "${key}".`);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    osuSource = new OsuSource(mockRedis, mockLockService, mockConfigService);
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(osuSource.sourceId).toBe(SourceId.Osu);
      expect(osuSource.sourceName).toBe("Osu!");
    });
  });

  describe("profileUrl", () => {
    it("Deve gerar a URL do perfil do osu! corretamente.", () => {
      expect(osuSource.profileUrl("octocat")).toBe("https://osu.ppy.sh/users/octocat");
    });
  });

  describe("onInit", () => {
    it("Deve lançar um erro quando OSU_CLIENT_ID não estiver configurado.", async () => {
      mockConfigService.get.mockImplementation((key: string) => (key === "OSU_CLIENT_SECRET" ? "secret" : undefined));

      await expect(osuSource.onInit()).rejects.toThrow("OSU_CLIENT_ID or OSU_CLIENT_SECRET is not configured.");
    });

    it("Deve lançar um erro quando OSU_CLIENT_SECRET não estiver configurado.", async () => {
      mockConfigService.get.mockImplementation((key: string) => (key === "OSU_CLIENT_ID" ? "id" : undefined));

      await expect(osuSource.onInit()).rejects.toThrow("OSU_CLIENT_ID or OSU_CLIENT_SECRET is not configured.");
    });

    it("Deve carregar o access token do Redis quando houver um token em cache válido.", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue("cached-token");
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await osuSource.onInit();

      expect(result).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect((osuSource as any).accessToken).toBe("cached-token");
    });

    it("Deve autenticar via API quando não houver token em cache no Redis.", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue(null);
      mockRedis.ttl.mockResolvedValue(-2);
      fetchSpy.mockResolvedValue(mockResponse(200, { access_token: "new-token", expires_in: 3600 }));

      const result = await osuSource.onInit();

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://osu.ppy.sh/oauth/token",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockRedis.set).toHaveBeenCalledWith(ACCESS_TOKEN_REDIS_KEY, "new-token", "EX", 3600);
      expect((osuSource as any).accessToken).toBe("new-token");
    });

    it("Deve autenticar via API quando o TTL do token em cache não for positivo.", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue("stale-token");
      mockRedis.ttl.mockResolvedValue(0);
      fetchSpy.mockResolvedValue(mockResponse(200, { access_token: "new-token", expires_in: 3600 }));

      await osuSource.onInit();

      expect(fetchSpy).toHaveBeenCalledWith("https://osu.ppy.sh/oauth/token", expect.any(Object));
    });

    it("Deve usar o TTL padrão de fallback quando a API não retornar 'expires_in'.", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue(null);
      mockRedis.ttl.mockResolvedValue(-2);
      fetchSpy.mockResolvedValue(mockResponse(200, { access_token: "new-token" }));

      await osuSource.onInit();

      expect(mockRedis.set).toHaveBeenCalledWith(ACCESS_TOKEN_REDIS_KEY, "new-token", "EX", 24 * 60 * 60);
    });

    it("Deve lançar um erro encapsulado quando a autenticação falhar durante a inicialização.", async () => {
      mockConfigCredentials();
      mockRedis.get.mockResolvedValue(null);
      mockRedis.ttl.mockResolvedValue(-2);
      fetchSpy.mockResolvedValue(mockResponse(401));

      await expect(osuSource.onInit()).rejects.toThrow("Failed to authenticate during initialization.");
    });
  });

  describe("scan", () => {
    it("Deve retornar 'found' quando a API responder com 200.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(200));

      const result = await osuSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar 'not_found' quando a API responder com 404.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(404));

      const result = await osuSource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status inesperado.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(500));

      await expect(osuSource.scan("octocat")).rejects.toThrow("osu! API request failed with status 500.");
    });

    it("Deve chamar a API com a URL correta e o header Authorization com o access token atual.", async () => {
      setValidAccessToken();
      fetchSpy.mockResolvedValue(mockResponse(200));

      await osuSource.scan("octo cat");

      expect(fetchSpy).toHaveBeenCalledWith("https://osu.ppy.sh/api/v2/users/octo%20cat", expect.any(Object));

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBe("Bearer valid-token");
      expect(headers.get("Accept")).toBe("application/json");
    });

    it("Deve renovar o access token quando estiver expirado antes de escanear, usando o lock de autenticação.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValue(true);

      fetchSpy.mockImplementation((url: string) => {
        if (url.toString().includes("oauth/token")) {
          return Promise.resolve(mockResponse(200, { access_token: "refreshed-token", expires_in: 3600 }));
        }
        return Promise.resolve(mockResponse(200));
      });

      const result = await osuSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
      expect(mockLockService.acquire).toHaveBeenCalledWith(AUTHENTICATE_LOCK_KEY, 90);
      expect(mockLockService.release).toHaveBeenCalledWith(AUTHENTICATE_LOCK_KEY);
      expect(mockRedis.set).toHaveBeenCalledWith(ACCESS_TOKEN_REDIS_KEY, "refreshed-token", "EX", 3600);

      const scanCall = fetchSpy.mock.calls.find(([url]: [string]) => !url.toString().includes("oauth/token"));
      const headers = scanCall?.[1].headers as Headers;

      expect(headers.get("Authorization")).toBe("Bearer refreshed-token");
    });

    it("Deve aguardar e tentar novamente quando o lock de autenticação não for adquirido de imediato.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      fetchSpy.mockImplementation((url: string) => {
        if (url.toString().includes("oauth/token")) {
          return Promise.resolve(mockResponse(200, { access_token: "refreshed-token", expires_in: 3600 }));
        }
        return Promise.resolve(mockResponse(200));
      });

      const result = await osuSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
      expect(mockLockService.acquire).toHaveBeenCalledTimes(2);
    });

    it("Deve lançar um erro de timeout quando exceder o número máximo de tentativas sem conseguir o lock.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValue(false);

      await expect(osuSource.scan("octocat")).rejects.toThrow("osu! authenticate lock timeout.");
      expect(mockLockService.acquire).toHaveBeenCalledTimes(11);
    });

    it("Deve liberar o lock mesmo quando a renovação do access token falhar.", async () => {
      mockConfigCredentials();
      mockLockService.acquire.mockResolvedValue(true);
      fetchSpy.mockResolvedValue(mockResponse(500));

      await expect(osuSource.scan("octocat")).rejects.toThrow("osu! OAuth token request failed with status 500.");
      expect(mockLockService.release).toHaveBeenCalledWith(AUTHENTICATE_LOCK_KEY);
    });
  });
});
