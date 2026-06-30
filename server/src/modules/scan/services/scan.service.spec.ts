import { SourceScanRepository } from "../repositories/sourceScan.repository";
import { ScanRepository } from "../repositories/scan.repository";
import { QUEUES_CONSTANTS } from "../../queue/queue.constants";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { ScanService } from "./scan.service";
import { LockService } from "./lock.service";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

describe("ScanService", () => {
  const mockConfig = { get: jest.fn() };

  const mockScanRepository = {
    findScan: jest.fn(),
    createPending: jest.fn(),
    updateToPending: jest.fn(),
    updateToFailed: jest.fn(),
  };

  const mockSourceScanRepository = {
    findSourceScans: jest.fn(),
  };

  const mockLockService = {
    withLock: jest.fn(),
  };

  const mockSourcesQueue = {
    addBulk: jest.fn(),
  };

  let scanService: ScanService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: getQueueToken(QUEUES_CONSTANTS.SOURCES), useValue: mockSourcesQueue },
        { provide: SourceScanRepository, useValue: mockSourceScanRepository },
        { provide: ScanRepository, useValue: mockScanRepository },
        { provide: LockService, useValue: mockLockService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    scanService = moduleRef.get(ScanService);

    jest.resetAllMocks();
  });

  describe("ScanService.scanNickname", () => {
    it("Should create pending scan and enqueue sources when scan does not exist. | Deve criar um 'scan' pendente e enfileirar as fontes quando o 'scan' não existir.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockScanRepository.findScan.mockResolvedValue(null);
      mockConfig.get.mockReturnValue("github");

      await scanService.scanNickname("test");

      expect(mockLockService.withLock).toHaveBeenCalledWith("lock:scan:test", 60 * 5, expect.any(Function));
      expect(mockScanRepository.createPending).toHaveBeenCalledWith("test");
      expect(mockSourcesQueue.addBulk).toHaveBeenCalledWith([{ name: "github", data: { nickname: "test" } }]);
    });

    it("should skip creating scan when scan already exists with pending status. | Deve ignorar a criação do 'scan' quando ele já existir com status pendente.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockScanRepository.findScan.mockResolvedValue({ nickname: "test", status: "pending" });
      mockConfig.get.mockReturnValue("github");

      await scanService.scanNickname("test");

      expect(mockScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockScanRepository.updateToPending).not.toHaveBeenCalled();
      expect(mockSourcesQueue.addBulk).toHaveBeenCalled();
    });

    it("should update existing scan to pending when scan exists with non-pending status. | Deve atualizar o 'scan' existente para pendente quando ele estiver em um status não pendente.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockScanRepository.findScan.mockResolvedValue({ nickname: "test", status: "completed" });
      mockConfig.get.mockReturnValue("github");

      await scanService.scanNickname("test");

      expect(mockScanRepository.updateToPending).toHaveBeenCalledWith("test");
      expect(mockSourcesQueue.addBulk).toHaveBeenCalled();
    });

    it("should update to failed when an error occurs during the scan. | Deve atualizar para 'failed' quando ocorrer um erro durante o 'scan'.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockScanRepository.findScan.mockRejectedValue(new Error("find error"));
      mockConfig.get.mockReturnValue("github");

      await scanService.scanNickname("test");

      expect(mockScanRepository.updateToFailed).toHaveBeenCalledWith("test");
    });

    it("should not proceed when lock is not acquired. | Não deve prosseguir quando o 'lock' não for adquirido.", async () => {
      mockLockService.withLock.mockResolvedValue(undefined);

      await scanService.scanNickname("test");

      expect(mockScanRepository.findScan).not.toHaveBeenCalled();
      expect(mockSourcesQueue.addBulk).not.toHaveBeenCalled();
    });

    it("should handle errors from updateToFailed gracefully. | Deve lidar com erros do 'updateToFailed' de forma graciosa.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockScanRepository.findScan.mockRejectedValue(new Error("find error"));
      mockScanRepository.updateToFailed.mockRejectedValue(new Error("save error"));
      mockConfig.get.mockReturnValue("github");

      await expect(scanService.scanNickname("test")).resolves.toBeUndefined();

      expect(mockScanRepository.updateToFailed).toHaveBeenCalledWith("test");
    });
  });

  describe("ScanService.findStatusNickname", () => {
    it("should return scan and sources when scan exists. | Deve retornar o 'scan' e as fontes quando o 'scan' existir.", async () => {
      const scan = { nickname: "test", status: "pending", createdAt: "now", startedAt: "now", completedAt: null };
      const sources = { github: { sourceId: "github", status: "pending" } };

      mockScanRepository.findScan.mockResolvedValue(scan);
      mockSourceScanRepository.findSourceScans.mockResolvedValue(sources);

      const result = await scanService.findStatusNickname("test");

      expect(result).toEqual({ scan, sources });
    });

    it("should return null when scan does not exist. | Deve retornar 'null' quando o 'scan' não existir.", async () => {
      mockScanRepository.findScan.mockResolvedValue(null);

      const result = await scanService.findStatusNickname("test");

      expect(result).toBeNull();
    });
  });
});
