import { REDIS_CLIENT } from "../../redis/redis.constants";
import { LockService } from "./lock.service";
import { Test } from "@nestjs/testing";

describe("LockService", () => {
  const redis = { set: jest.fn(), del: jest.fn() };
  let lockService: LockService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [{ provide: REDIS_CLIENT, useValue: redis }, LockService],
    }).compile();

    lockService = moduleRef.get(LockService);

    jest.resetAllMocks();
  });

  describe("LockService.withLock", () => {
    it("Should execute callback when lock is acquired. | Deve executar o callback quando o bloqueio for adquirido.", async () => {
      redis.set.mockResolvedValue("OK");
      redis.del.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue(undefined);

      await lockService.withLock("lock:test", 60, callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("Should release the lock after callback. | Deve liberar o bloqueio após o callback.", async () => {
      redis.set.mockResolvedValue("OK");
      redis.del.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue(undefined);

      await lockService.withLock("lock:test", 60, callback);

      expect(redis.del).toHaveBeenCalledWith("lock:test");
    });

    it("Should release the lock even if callback throws. | Deve liberar o bloqueio mesmo se o callback lançar um erro.", async () => {
      redis.set.mockResolvedValue("OK");
      redis.del.mockResolvedValue(1);

      const error = new Error("boom");

      await expect(lockService.withLock("lock:test", 60, () => Promise.reject(error))).rejects.toThrow(error);

      expect(redis.del).toHaveBeenCalledWith("lock:test");
    });

    it("Should return callback result. | Deve retornar o resultado do callback.", async () => {
      redis.set.mockResolvedValue("OK");
      redis.del.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue("result");

      const result = await lockService.withLock("lock:test", 60, callback);

      expect(result).toBe("result");
    });
  });

  describe("LockService.acquire", () => {
    it("Should return true when the lock is acquired. | Deve retornar verdadeiro quando o bloqueio for adquirido.", async () => {
      redis.set.mockResolvedValue("OK");

      const result = await lockService.acquire("lock:test", 60);

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith("lock:test", "1", "EX", 60, "NX");
    });

    it("should return false when the lock already exists", async () => {
      redis.set.mockResolvedValue(null);

      const result = await lockService.acquire("lock:test", 60);

      expect(result).toBe(false);
    });
  });

  describe("LockService.release", () => {
    it("Should release the lock. | Deve liberar o bloqueio.", async () => {
      redis.del.mockResolvedValue(1);

      await lockService.release("lock:test");

      expect(redis.del).toHaveBeenCalledWith("lock:test");
    });
  });
});
