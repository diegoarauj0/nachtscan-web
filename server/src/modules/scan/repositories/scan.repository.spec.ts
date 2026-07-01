import { REDIS_CLIENT } from "../../redis/redis.constants";
import { ScanRepository } from "./scan.repository";
import { mockDeep } from "jest-mock-extended";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";

jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

describe("ScanRepository", () => {
  const mockRedis = mockDeep<Redis>();

  let scanRepository: ScanRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [{ provide: REDIS_CLIENT, useValue: mockRedis }, ScanRepository],
    }).compile();

    scanRepository = moduleRef.get(ScanRepository);

    jest.resetAllMocks();
  });

  describe("ScanRepository.updateToComplete", () => {
    it("Deve atualizar o status do 'scan' para 'completed'.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      mockRedis.get.mockResolvedValue(JSON.stringify(scan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToComplete(nickname);

      expect(result.status).toBe("completed");
      expect(result.completedAt).not.toBeNull();
    });

    it("Deve salvar o 'scan' atualizado.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      mockRedis.get.mockResolvedValue(JSON.stringify(scan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToComplete(nickname);

      expect(mockRedis.set).toHaveBeenCalledWith(
        scanRepository["scanKey"](nickname),
        JSON.stringify(result),
        "EX",
        scanRepository["SCAN_TTL"],
      );
    });

    it("Deve lançar um erro quando o 'scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(scanRepository.updateToComplete("test")).rejects.toBeInstanceOf(Error);
    });

    it("Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const nickname = "test";

      mockRedis.get.mockResolvedValue(JSON.stringify(scanRepository["createPendingScan"](nickname)));

      mockRedis.set.mockResolvedValue(null);

      await expect(scanRepository.updateToComplete(nickname)).rejects.toBeInstanceOf(Error);
    });
  });

  describe("ScanRepository.findScan", () => {
    it("Deve retornar o 'scan'.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      mockRedis.get.mockResolvedValue(JSON.stringify(scan));

      const result = await scanRepository.findScan(nickname);

      expect(result).toStrictEqual(scan);
    });

    it("Deve retornar 'null' quando o 'scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await scanRepository.findScan("test");

      expect(result).toBeNull();
    });
  });

  describe("ScanRepository.updateToFailed", () => {
    it("Deve atualizar o status do 'scan' para 'failed'.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      mockRedis.get.mockResolvedValue(JSON.stringify(scan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToFailed(nickname);

      expect(result.status).toBe("failed");
      expect(result.completedAt).not.toBeNull();
    });

    it("Deve salvar o 'scan' atualizado.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      mockRedis.get.mockResolvedValue(JSON.stringify(scan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToFailed(nickname);

      expect(mockRedis.set).toHaveBeenCalledWith(
        scanRepository["scanKey"](nickname),
        JSON.stringify(result),
        "EX",
        scanRepository["SCAN_TTL"],
      );
    });

    it("Deve lançar um erro quando o 'scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(scanRepository.updateToFailed("test")).rejects.toBeInstanceOf(Error);
    });

    it("Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const nickname = "test";

      mockRedis.get.mockResolvedValue(JSON.stringify(scanRepository["createPendingScan"](nickname)));

      mockRedis.set.mockResolvedValue(null);

      await expect(scanRepository.updateToFailed(nickname)).rejects.toBeInstanceOf(Error);
    });
  });

  describe("ScanRepository.updateToPending", () => {
    it("Deve atualizar o status do 'scan' para 'pending'.", async () => {
      const nickname = "test";

      const scan = {
        nickname,
        status: "completed",
        createdAt: "created",
        startedAt: "old",
        completedAt: "completed",
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(scan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToPending(nickname);

      expect(result.status).toBe("pending");
      expect(result.completedAt).toBeNull();
      expect(result.startedAt).not.toBe("old");
    });

    it("Deve salvar o 'scan' atualizado.", async () => {
      const nickname = "test";

      const scan = {
        nickname,
        status: "completed",
        createdAt: "created",
        startedAt: "old",
        completedAt: "completed",
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(scan));
      mockRedis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToPending(nickname);

      expect(mockRedis.set).toHaveBeenCalledWith(
        scanRepository["scanKey"](nickname),
        JSON.stringify(result),
        "EX",
        10 * 60,
      );
    });

    it("Deve lançar um erro quando o 'scan' não existir.", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(scanRepository.updateToPending("test")).rejects.toBeInstanceOf(Error);
    });

    it("Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const nickname = "test";

      mockRedis.get.mockResolvedValue(JSON.stringify(scanRepository["createPendingScan"](nickname)));

      mockRedis.set.mockResolvedValue(null);

      await expect(scanRepository.updateToPending(nickname)).rejects.toBeInstanceOf(Error);
    });
  });

  describe("ScanRepository.createPending", () => {
    it("Deve criar e retornar o objeto 'scan' com status pendente.", async () => {
      const nickname = "test";

      mockRedis.set.mockResolvedValue("OK");

      const result = await scanRepository.createPending(nickname);

      expect(result).toStrictEqual(scanRepository["createPendingScan"](nickname));
    });

    it("Deve criar e salvar com o objeto 'scan' com status pendente.", async () => {
      const nickname = "test";

      mockRedis.set.mockResolvedValue("OK");

      const scanTTL = scanRepository["SCAN_TTL"];
      const scanKey = scanRepository["scanKey"](nickname);

      const result = await scanRepository.createPending(nickname);

      expect(mockRedis.set).toHaveBeenCalledWith(scanKey, JSON.stringify(result), "EX", scanTTL, "NX");
    });

    it("Deve lançar um erro porque 'redis.set' retornou 'null'.", async () => {
      const nickname = "test";

      mockRedis.set.mockResolvedValue(null);

      await expect(scanRepository.createPending(nickname)).rejects.toBeInstanceOf(Error);
    });
  });
});
