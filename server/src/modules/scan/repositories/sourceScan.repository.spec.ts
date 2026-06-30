import { REDIS_CLIENT } from "../../redis/redis.constants";
import { SourceScanRepository } from "./sourceScan.repository";
import { InterfaceSourceScan } from "../scan.type";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

describe("SourceScanRepository", () => {
  const mockRedis = { set: jest.fn(), get: jest.fn() };
  const mockConfig = { get: jest.fn() };

  let sourceScanRepository: SourceScanRepository;

  const now = new Date("2026-01-01T12:00:00.000Z");

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: mockConfig },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        SourceScanRepository,
      ],
    }).compile();

    sourceScanRepository = moduleRef.get(SourceScanRepository);

    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("SourceScanRepository.findSourceScan", () => {
    it("should return source scan. | Deve retornar o 'source scan'.", async () => {
      const sourceScan = createSourceScan();

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));

      const result = await sourceScanRepository.findSourceScan("test", "github");

      expect(mockRedis.get).toHaveBeenCalledWith(sourceScanRepository["sourceScanKey"]("test", "github"));
      expect(result).toStrictEqual(sourceScan);
    });

    it("should return null when source scan does not exist. | Deve retornar 'null' quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await sourceScanRepository.findSourceScan("test", "github");

      expect(result).toBeNull();
    });
  });

  describe("SourceScanRepository.findSourceScans", () => {
    it("should return source scans indexed by source id. | Deve retornar os 'source scans' indexados pelo 'source id'.", async () => {
      const sourceScan = createSourceScan();

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockConfig.get.mockReturnValue("github");

      const result = await sourceScanRepository.findSourceScans("test");

      expect(mockRedis.get).toHaveBeenCalledWith(sourceScanRepository["sourceScanKey"]("test", "github"));
      expect(result).toStrictEqual({ github: sourceScan });
    });

    it("should skip missing source scans. | Deve ignorar 'source scans' ausentes.", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockConfig.get.mockReturnValue("github");

      const result = await sourceScanRepository.findSourceScans("test");

      expect(result).toStrictEqual({});
    });
  });

  describe("SourceScanRepository.createPending", () => {
    it("should create and return source scan with pending status. | Deve criar e retornar o 'source scan' com status pendente.", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.createPending({
        nickname: "test",
        profileUrl: "https://github.com/test",
        sourceId: "github",
        sourceName: "Github",
      });

      expect(result).toStrictEqual(
        sourceScanRepository["createPendingSourceScan"]("github", "Github", "https://github.com/test"),
      );
    });

    it("should save source scan with ttl and nx option. | Deve salvar o 'source scan' com 'ttl' e opção 'NX'.", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.createPending({
        nickname: "test",
        profileUrl: "https://github.com/test",
        sourceId: "github",
        sourceName: "Github",
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        sourceScanRepository["sourceScanKey"]("test", "github"),
        JSON.stringify(result),
        "EX",
        sourceScanRepository["SOURCE_SCAN_TTL"],
        "NX",
      );
    });

    it("should throw when redis.set returns null. | Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      mockRedis.set.mockResolvedValue(null);

      await expect(
        sourceScanRepository.createPending({
          nickname: "test",
          profileUrl: "https://github.com/test",
          sourceId: "github",
          sourceName: "Github",
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("SourceScanRepository.updateToCompleted", () => {
    it("should update source scan status to found. | Deve atualizar o status do 'source scan' para 'found'.", async () => {
      const sourceScan = createSourceScan();

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToCompleted({
        nickname: "test",
        sourceId: "github",
        found: true,
        cacheExpiresInMs: 60_000,
      });

      expect(result.status).toBe("found");
      expect(result.completedAt).toBe(now.toUTCString());
      expect(result.error).toBeNull();
      expect(result.cached).toBe(true);
      expect(result.cachedAt).toBe(now.toUTCString());
      expect(result.cacheExpiresAt).toBe(new Date(now.getTime() + 60_000).toUTCString());
    });

    it("should update source scan status to not_found. | Deve atualizar o status do 'source scan' para 'not_found'.", async () => {
      const sourceScan = createSourceScan();

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToCompleted({
        nickname: "test",
        sourceId: "github",
        found: false,
        cacheExpiresInMs: 60_000,
      });

      expect(result.status).toBe("not_found");
    });

    it("should save updated source scan. | Deve salvar o 'source scan' atualizado.", async () => {
      const sourceScan = createSourceScan();

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToCompleted({
        nickname: "test",
        sourceId: "github",
        found: true,
        cacheExpiresInMs: 60_000,
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        sourceScanRepository["sourceScanKey"]("test", "github"),
        JSON.stringify(result),
        "EX",
        sourceScanRepository["SOURCE_SCAN_TTL"],
      );
    });

    it("should throw when source scan does not exist. | Deve lançar um erro quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToCompleted({
          nickname: "test",
          sourceId: "github",
          found: true,
          cacheExpiresInMs: 60_000,
        }),
      ).rejects.toBeInstanceOf(Error);
    });

    it("should throw when redis.set returns null. | Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(createSourceScan()));
      mockRedis.set.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToCompleted({
          nickname: "test",
          sourceId: "github",
          found: true,
          cacheExpiresInMs: 60_000,
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("SourceScanRepository.updateToFailed", () => {
    it("should update source scan status to failed. | Deve atualizar o status do 'source scan' para 'failed'.", async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify(createSourceScan({ cached: true, cachedAt: "cached", cacheExpiresAt: "expires" })),
      );
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToFailed({
        nickname: "test",
        sourceId: "github",
        error: "Request failed",
      });

      expect(result.status).toBe("failed");
      expect(result.completedAt).toBe(now.toUTCString());
      expect(result.error).toBe("Request failed");
      expect(result.cached).toBe(false);
      expect(result.cachedAt).toBeNull();
      expect(result.cacheExpiresAt).toBeNull();
    });

    it("should save updated source scan. | Deve salvar o 'source scan' atualizado.", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(createSourceScan()));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToFailed({
        nickname: "test",
        sourceId: "github",
        error: "Request failed",
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        sourceScanRepository["sourceScanKey"]("test", "github"),
        JSON.stringify(result),
        "EX",
        sourceScanRepository["SOURCE_SCAN_TTL"],
      );
    });

    it("should throw when source scan does not exist. | Deve lançar um erro quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToFailed({
          nickname: "test",
          sourceId: "github",
          error: "Request failed",
        }),
      ).rejects.toBeInstanceOf(Error);
    });

    it("should throw when redis.set returns null. | Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(createSourceScan()));
      mockRedis.set.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToFailed({
          nickname: "test",
          sourceId: "github",
          error: "Request failed",
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("SourceScanRepository.updateToPending", () => {
    it("should update source scan status to pending. | Deve atualizar o status do 'source scan' para 'pending'.", async () => {
      const sourceScan = createSourceScan({
        status: "found",
        startedAt: "old",
        completedAt: "completed",
      });

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToPending("test", "github");

      expect(result.status).toBe("pending");
      expect(result.startedAt).toBe(now.toUTCString());
      expect(result.completedAt).toBeNull();
    });

    it("should save updated source scan. | Deve salvar o 'source scan' atualizado.", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(createSourceScan({ status: "found" })));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToPending("test", "github");

      expect(mockRedis.set).toHaveBeenCalledWith(
        sourceScanRepository["sourceScanKey"]("test", "github"),
        JSON.stringify(result),
        "EX",
        sourceScanRepository["SOURCE_SCAN_TTL"],
      );
    });

    it("should throw when source scan does not exist. | Deve lançar um erro quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(sourceScanRepository.updateToPending("test", "github")).rejects.toBeInstanceOf(Error);
    });

    it("should throw when redis.set returns null. | Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(createSourceScan()));
      mockRedis.set.mockResolvedValue(null);

      await expect(sourceScanRepository.updateToPending("test", "github")).rejects.toBeInstanceOf(Error);
    });
  });
});

function createSourceScan(overrides: Partial<InterfaceSourceScan> = {}): InterfaceSourceScan {
  return {
    sourceId: "github",
    sourceName: "Github",
    status: "pending",
    profileUrl: "https://github.com/test",
    cached: false,
    cachedAt: null,
    cacheExpiresAt: null,
    createdAt: "created",
    startedAt: "started",
    completedAt: null,
    error: null,
    ...overrides,
  };
}
