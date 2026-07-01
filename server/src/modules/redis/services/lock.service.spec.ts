import { REDIS_CLIENT } from "../../redis/redis.constants";
import { mockDeep } from "jest-mock-extended";
import { LockService } from "./lock.service";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";

describe("LockService", () => {
  const mockRedis = mockDeep<Redis>();

  const key = "lock:test";

  let lockService: LockService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [{ provide: REDIS_CLIENT, useValue: mockRedis }, LockService],
    }).compile();

    lockService = moduleRef.get(LockService);

    jest.resetAllMocks();
  });

  describe("LockService.withLock", () => {
    it("Deve executar o callback quando o bloqueio for adquirido.", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue(undefined);

      await lockService.withLock(key, 60, callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("Deve liberar o bloqueio após o callback.", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue(undefined);

      await lockService.withLock(key, 60, callback);

      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    it("Deve liberar o bloqueio mesmo se o callback lançar um erro.", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);

      const error = new Error("boom");

      await expect(lockService.withLock(key, 60, () => Promise.reject(error))).rejects.toThrow(error);

      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    it("Deve retornar o resultado do callback.", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue("result");

      const result = await lockService.withLock(key, 60, callback);

      expect(result).toBe("result");
    });
  });

  describe("LockService.acquire", () => {
    it("Deve retornar true quando o redis retornar 'OK'.", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const result = await lockService.acquire(key, 60);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(key, "1", "EX", 60, "NX");
    });

    it("Deve retornar false quando o redis retornar null", async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await lockService.acquire(key, 60);

      expect(result).toBe(false);
    });
  });

  describe("LockService.release", () => {
    it("Deve liberar o bloqueio.", async () => {
      mockRedis.del.mockResolvedValue(1);

      await lockService.release(key);

      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });
  });
});
