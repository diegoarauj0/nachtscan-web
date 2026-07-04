import { SourceScanRepository } from "./sourceScan.repository";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { SourcesRegistry } from "../sources.registry";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

describe("SourceScanRepository", () => {
  const mockRedis = mockDeep<Redis>();
  const mockSourcesRegistry = mockDeep<SourcesRegistry>();

  let sourceScanRepository: SourceScanRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: SourcesRegistry, useValue: mockSourcesRegistry },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        SourceScanRepository,
      ],
    }).compile();

    sourceScanRepository = moduleRef.get(SourceScanRepository);

    jest.resetAllMocks();
  });

  describe("SourceScanRepository.findSourceScan", () => {
    it("Deve retornar o 'source scan'.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));

      const result = await sourceScanRepository.findSourceScan("test", SourceId.GitHub);

      expect(mockRedis.get).toHaveBeenCalledWith(sourceScanRepository["sourceScanKey"]("test", SourceId.GitHub));
      expect(result).toStrictEqual(sourceScan);
    });

    it("Deve retornar 'null' quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await sourceScanRepository.findSourceScan("test", SourceId.GitHub);

      expect(result).toBeNull();
    });
  });

  describe("SourceScanRepository.findSourceScans", () => {
    it("Deve retornar os 'source scans' indexados pelo 'source id'.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockSourcesRegistry.sourcesInArray.mockReturnValue([{ sourceId: SourceId.GitHub, sourceName: "Github" }] as any);

      const result = await sourceScanRepository.findSourceScans("test");

      const key = sourceScanRepository["sourceScanKey"]("test", SourceId.GitHub);

      expect(mockRedis.get).toHaveBeenCalledWith(key);
      expect(result).toStrictEqual([sourceScan]);
    });

    it("Deve ignorar 'source scans' ausentes.", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockSourcesRegistry.sourcesInArray.mockReturnValue([{ sourceId: SourceId.GitHub, sourceName: "Github" }] as any);

      const result = await sourceScanRepository.findSourceScans("test");

      expect(result).toStrictEqual([]);
    });
  });

  describe("SourceScanRepository.createPending", () => {
    it("Deve criar e retornar o 'source scan' com status pendente.", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.createPending({
        profileUrl: "https://github.com/test",
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        site: "https://github.com",
        nickname: "test",
      });

      const sourceScan = sourceScanRepository["createPendingSourceScan"](
        SourceId.GitHub,
        "Github",
        "https://github.com/test",
        "https://github.com",
      );

      expect(result).toStrictEqual(sourceScan);
    });

    it("Deve salvar o 'source scan' com 'ttl' e opção 'NX'.", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.createPending({
        profileUrl: "https://github.com/test",
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        site: "https://github.com",
        nickname: "test",
      });

      const key = sourceScanRepository["sourceScanKey"]("test", SourceId.GitHub);
      const stringify = JSON.stringify(result);

      expect(mockRedis.set).toHaveBeenCalledWith(key, stringify, "EX", sourceScanRepository["SOURCE_SCAN_TTL"], "NX");
    });

    it("Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      mockRedis.set.mockResolvedValue(null);

      await expect(
        sourceScanRepository.createPending({
          profileUrl: "https://github.com/test",
          sourceId: SourceId.GitHub,
          sourceName: "Github",
          site: "https://github.com",
          nickname: "test",
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("SourceScanRepository.updateToCompleted", () => {
    it("Deve atualizar o status do 'source scan' para 'found'.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToCompleted({
        sourceId: SourceId.GitHub,
        cacheExpiresInMs: 60_000,
        nickname: "test",
        found: true,
      });

      expect(result.status).toBe("found");
    });

    it("Deve atualizar o status do 'source scan' para 'not_found'.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToCompleted({
        sourceId: SourceId.GitHub,
        cacheExpiresInMs: 60_000,
        nickname: "test",
        found: false,
      });

      expect(result.status).toBe("not_found");
    });

    it("Deve salvar o 'source scan' atualizado.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToCompleted({
        sourceId: SourceId.GitHub,
        cacheExpiresInMs: 60_000,
        nickname: "test",
        found: true,
      });

      const stringify = JSON.stringify(result);
      const sourceScanTTL = sourceScanRepository["SOURCE_SCAN_TTL"];

      expect(mockRedis.set).toHaveBeenCalledWith(
        sourceScanRepository["sourceScanKey"]("test", SourceId.GitHub),
        stringify,
        "EX",
        sourceScanTTL,
      );
    });

    it("Deve lançar um erro quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToCompleted({
          sourceId: SourceId.GitHub,
          cacheExpiresInMs: 60_000,
          nickname: "test",
          found: true,
        }),
      ).rejects.toBeInstanceOf(Error);
    });

    it("Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToCompleted({
          sourceId: SourceId.GitHub,
          cacheExpiresInMs: 60_000,
          nickname: "test",
          found: true,
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("SourceScanRepository.updateToFailed", () => {
    it("Deve atualizar o status do 'source scan' para 'failed'.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToFailed({
        sourceId: SourceId.GitHub,
        error: "Request failed",
        nickname: "test",
      });

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Request failed");
    });

    it("Deve salvar o 'source scan' atualizado.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToFailed({
        sourceId: SourceId.GitHub,
        error: "Request failed",
        nickname: "test",
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        sourceScanRepository["sourceScanKey"]("test", SourceId.GitHub),
        JSON.stringify(result),
        "EX",
        sourceScanRepository["SOURCE_SCAN_TTL"],
      );
    });

    it("Deve lançar um erro quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToFailed({
          sourceId: SourceId.GitHub,
          error: "Request failed",
          nickname: "test",
        }),
      ).rejects.toBeInstanceOf(Error);
    });

    it("Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const sourceScan = { sourceId: SourceId.GitHub, sourceName: "Github" };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue(null);

      await expect(
        sourceScanRepository.updateToFailed({
          sourceId: SourceId.GitHub,
          error: "Request failed",
          nickname: "test",
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("SourceScanRepository.updateToPending", () => {
    it("Deve atualizar o status do 'source scan' para 'pending'.", async () => {
      const sourceScan = {
        sourceId: SourceId.GitHub,
        completedAt: "completed",
        sourceName: "Github",
        startedAt: "old",
        status: "found",
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToPending("test", SourceId.GitHub);

      expect(result.status).toBe("pending");
      expect(result.completedAt).toBeNull();
    });

    it("Deve salvar o 'source scan' atualizado.", async () => {
      const sourceScan = {
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        status: "found",
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await sourceScanRepository.updateToPending("test", SourceId.GitHub);

      expect(mockRedis.set).toHaveBeenCalledWith(
        sourceScanRepository["sourceScanKey"]("test", SourceId.GitHub),
        JSON.stringify(result),
        "EX",
        sourceScanRepository["SOURCE_SCAN_TTL"],
      );
    });

    it("Deve lançar um erro quando o 'source scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(sourceScanRepository.updateToPending("test", SourceId.GitHub)).rejects.toBeInstanceOf(Error);
    });

    it("Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const sourceScan = {
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        status: "found",
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(sourceScan));
      mockRedis.set.mockResolvedValue(null);

      await expect(sourceScanRepository.updateToPending("test", SourceId.GitHub)).rejects.toBeInstanceOf(Error);
    });
  });
});
