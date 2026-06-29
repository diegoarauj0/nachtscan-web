import { REDIS_CLIENT } from "../../redis/redis.constants";
import { ScanRepository } from "./scan.repository";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";

jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

describe("ScanRepository", () => {
  const redis = { set: jest.fn(), get: jest.fn() };
  let scanRepository: ScanRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [{ provide: REDIS_CLIENT, useValue: redis }, ScanRepository],
    }).compile();

    scanRepository = moduleRef.get(ScanRepository);

    jest.resetAllMocks();
  });

  describe("ScanRepository.updateToComplete", () => {
    it("should update scan status to completed. | Deve atualizar o status do 'scan' para 'completed'.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      redis.get.mockResolvedValue(JSON.stringify(scan));
      redis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToComplete(nickname);

      expect(result.status).toBe("completed");
      expect(result.completedAt).not.toBeNull();
    });

    it("should save updated scan. | Deve salvar o 'scan' atualizado.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      redis.get.mockResolvedValue(JSON.stringify(scan));
      redis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToComplete(nickname);

      expect(redis.set).toHaveBeenCalledWith(
        scanRepository["scanKey"](nickname),
        JSON.stringify(result),
        "EX",
        scanRepository["SCAN_TTL"],
      );
    });

    it("should throw when scan does not exist. | Deve lançar um erro quando o 'scan' não existir.", async () => {
      redis.get.mockResolvedValue(null);

      await expect(scanRepository.updateToComplete("test")).rejects.toBeInstanceOf(Error);
    });

    it("should throw when redis.set returns null. | Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const nickname = "test";

      redis.get.mockResolvedValue(JSON.stringify(scanRepository["createPendingScan"](nickname)));

      redis.set.mockResolvedValue(null);

      await expect(scanRepository.updateToComplete(nickname)).rejects.toBeInstanceOf(Error);
    });
  });

  describe("ScanRepository.findScan", () => {
    it("should return scan. | Deve retornar o 'scan'.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      redis.get.mockResolvedValue(JSON.stringify(scan));

      const result = await scanRepository.findScan(nickname);

      expect(result).toStrictEqual(scan);
    });

    it("should return null when scan does not exist. | Deve retornar 'null' quando o 'scan' não existir.", async () => {
      redis.get.mockResolvedValue(null);

      const result = await scanRepository.findScan("test");

      expect(result).toBeNull();
    });
  });

  describe("ScanRepository.updateToFailed", () => {
    it("should update scan status to failed. | Deve atualizar o status do 'scan' para 'failed'.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      redis.get.mockResolvedValue(JSON.stringify(scan));
      redis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToFailed(nickname);

      expect(result.status).toBe("failed");
      expect(result.completedAt).not.toBeNull();
    });

    it("should save updated scan. | Deve salvar o 'scan' atualizado.", async () => {
      const nickname = "test";

      const scan = scanRepository["createPendingScan"](nickname);

      redis.get.mockResolvedValue(JSON.stringify(scan));
      redis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToFailed(nickname);

      expect(redis.set).toHaveBeenCalledWith(
        scanRepository["scanKey"](nickname),
        JSON.stringify(result),
        "EX",
        scanRepository["SCAN_TTL"],
      );
    });

    it("should throw when scan does not exist. | Deve lançar um erro quando o 'scan' não existir.", async () => {
      redis.get.mockResolvedValue(null);

      await expect(scanRepository.updateToFailed("test")).rejects.toBeInstanceOf(Error);
    });

    it("should throw when redis.set returns null. | Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const nickname = "test";

      redis.get.mockResolvedValue(JSON.stringify(scanRepository["createPendingScan"](nickname)));

      redis.set.mockResolvedValue(null);

      await expect(scanRepository.updateToFailed(nickname)).rejects.toBeInstanceOf(Error);
    });
  });

  describe("ScanRepository.updateToPending", () => {
    it("should update scan status to pending. | Deve atualizar o status do 'scan' para 'pending'.", async () => {
      const nickname = "test";

      const scan = {
        nickname,
        status: "completed",
        createdAt: "created",
        startedAt: "old",
        completedAt: "completed",
      };

      redis.get.mockResolvedValue(JSON.stringify(scan));
      redis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToPending(nickname);

      expect(result.status).toBe("pending");
      expect(result.completedAt).toBeNull();
      expect(result.startedAt).not.toBe("old");
    });

    it("should save updated scan. | Deve salvar o 'scan' atualizado.", async () => {
      const nickname = "test";

      const scan = {
        nickname,
        status: "completed",
        createdAt: "created",
        startedAt: "old",
        completedAt: "completed",
      };

      redis.get.mockResolvedValue(JSON.stringify(scan));
      redis.set.mockResolvedValue("OK");

      const result = await scanRepository.updateToPending(nickname);

      expect(redis.set).toHaveBeenCalledWith(
        scanRepository["scanKey"](nickname),
        JSON.stringify(result),
        "EX",
        10 * 60,
      );
    });

    it("should throw when scan does not exist. | Deve lançar um erro quando o 'scan' não existir.", async () => {
      redis.get.mockResolvedValue(null);

      await expect(scanRepository.updateToPending("test")).rejects.toBeInstanceOf(Error);
    });

    it("should throw when redis.set returns null. | Deve lançar um erro quando 'redis.set' retornar 'null'.", async () => {
      const nickname = "test";

      redis.get.mockResolvedValue(JSON.stringify(scanRepository["createPendingScan"](nickname)));

      redis.set.mockResolvedValue(null);

      await expect(scanRepository.updateToPending(nickname)).rejects.toBeInstanceOf(Error);
    });
  });

  describe("ScanRepository.createPending", () => {
    it("should create and return scan object pending status. | Deve criar e retornar o objeto 'scan' com status pendente.", async () => {
      const nickname = "test";

      redis.set.mockResolvedValue("OK");

      const result = await scanRepository.createPending(nickname);

      expect(result).toStrictEqual(scanRepository["createPendingScan"](nickname));
    });

    it("should create and save with the scan object pending status. | Deve criar e salvar com o objeto 'scan' com status pendente.", async () => {
      const nickname = "test";

      redis.set.mockResolvedValue("OK");

      const scanTTL = scanRepository["SCAN_TTL"];
      const scanKey = scanRepository["scanKey"](nickname);

      const result = await scanRepository.createPending(nickname);

      expect(redis.set).toHaveBeenCalledWith(scanKey, JSON.stringify(result), "EX", scanTTL, "NX");
    });

    it("should throws an error because redis.set returns null. | Deve lançar um erro porque 'redis.set' retornou 'null'.", async () => {
      const nickname = "test";

      redis.set.mockResolvedValue(null);

      await expect(scanRepository.createPending(nickname)).rejects.toBeInstanceOf(Error);
    });
  });
});
