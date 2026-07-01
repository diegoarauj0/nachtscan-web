import { SourceScanRepository } from "@/modules/source/repositories/sourceScan.repository";
import { SourcesQueueEvents } from "@/modules/source/sources.QueueEvents";
import { SourcesRegistry } from "@/modules/source/sources.registry";
import { LockService } from "@/modules/redis/services/lock.service";
import { QUEUES_CONSTANTS } from "@/modules/queue/queue.constants";
import { ScanRepository } from "../repositories/scan.repository";
import { SourceId } from "@/modules/source/source.type";
import { mockDeep, mockFn } from "jest-mock-extended";
import { getQueueToken } from "@nestjs/bullmq";
import { ScanService } from "./scan.service";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Job, Queue } from "bullmq";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

describe("ScanService", () => {
  const mockSourcesQueueEvents = mockDeep<SourcesQueueEvents>();
  const mockSourceScanRepository = mockDeep<SourceScanRepository>();
  const mockSourcesRegistry = mockDeep<SourcesRegistry>();
  const mockScanRepository = mockDeep<ScanRepository>();
  const mockLockService = mockDeep<LockService>();
  const mockSourcesQueue = mockDeep<Queue>();

  let scanService: ScanService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: getQueueToken(QUEUES_CONSTANTS.SOURCES), useValue: mockSourcesQueue },
        { provide: SourceScanRepository, useValue: mockSourceScanRepository },
        { provide: SourcesQueueEvents, useValue: mockSourcesQueueEvents },
        { provide: SourcesRegistry, useValue: mockSourcesRegistry },
        { provide: ScanRepository, useValue: mockScanRepository },
        { provide: LockService, useValue: mockLockService },
      ],
    }).compile();

    scanService = moduleRef.get(ScanService);

    jest.resetAllMocks();
  });

  describe("ScanService.scanNickname", () => {
    it("Deve criar um 'scan' pendente e enfileirar as fontes quando o 'scan' não existir.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.sourcesInArray.mockReturnValue([{ sourceName: "github", sourceId: SourceId.GitHub }] as any);
      mockScanRepository.findScan.mockResolvedValue(null);

      await scanService.scanNickname("test");

      expect(mockLockService.withLock).toHaveBeenCalledWith("lock:scan:test", 60 * 5, expect.any(Function));
      expect(mockScanRepository.createPending).toHaveBeenCalledWith("test");
      expect(mockSourcesQueue.addBulk).toHaveBeenCalledWith([{ name: "github", data: { nickname: "test" } }]);
    });

    it("Deve ignorar a criação do 'scan' quando ele já existir com status pendente.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.sourcesInArray.mockReturnValue([{ sourceName: "github", sourceId: SourceId.GitHub }] as any);
      mockScanRepository.findScan.mockResolvedValue({ nickname: "test", status: "pending" } as any);

      await scanService.scanNickname("test");

      expect(mockScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockScanRepository.updateToPending).not.toHaveBeenCalled();
      expect(mockSourcesQueue.addBulk).toHaveBeenCalled();
    });

    it("Deve atualizar o 'scan' existente para pendente quando ele estiver em um status não pendente.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.sourcesInArray.mockReturnValue([{ sourceName: "github", sourceId: SourceId.GitHub }] as any);
      mockScanRepository.findScan.mockResolvedValue({ nickname: "test", status: "completed" } as any);

      await scanService.scanNickname("test");

      expect(mockScanRepository.updateToPending).toHaveBeenCalledWith("test");
      expect(mockSourcesQueue.addBulk).toHaveBeenCalled();
    });

    it("Deve atualizar para 'failed' quando ocorrer um erro durante o 'scan'.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.sourcesInArray.mockReturnValue([{ sourceName: "github", sourceId: SourceId.GitHub }] as any);
      mockScanRepository.findScan.mockRejectedValue(new Error("find error"));

      await scanService.scanNickname("test");

      expect(mockScanRepository.updateToFailed).toHaveBeenCalledWith("test");
    });

    it("Não deve prosseguir quando o 'lock' não for adquirido.", async () => {
      mockLockService.withLock.mockResolvedValue(undefined);

      await scanService.scanNickname("test");

      expect(mockScanRepository.findScan).not.toHaveBeenCalled();
      expect(mockSourcesQueue.addBulk).not.toHaveBeenCalled();
    });

    it("Deve lidar com erros do 'updateToFailed'.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.sourcesInArray.mockReturnValue([{ sourceName: "github", sourceId: SourceId.GitHub }] as any);
      mockScanRepository.findScan.mockRejectedValue(new Error("find error"));
      mockScanRepository.updateToFailed.mockRejectedValue(new Error("save error"));

      await expect(scanService.scanNickname("test")).resolves.toBeUndefined();

      expect(mockScanRepository.updateToFailed).toHaveBeenCalledWith("test");
    });
  });

  describe("ScanService.onModuleDestroy", () => {
    it("Deve fecha o 'sourcesQueueEvents'.", async () => {
      mockSourcesQueueEvents.close.mockResolvedValue();

      await scanService.onModuleDestroy();

      expect(mockSourcesQueueEvents.close).toHaveBeenCalledWith();
    });
  });

  describe("ScanService.onModuleInit", () => {
    it("Deve adicionar 'failed' event.", () => {
      scanService.onModuleInit();

      expect(mockSourcesQueueEvents.on).toHaveBeenCalledWith("failed", expect.anything());
    });

    it("Deve adicionar 'completed' event.", () => {
      scanService.onModuleInit();

      expect(mockSourcesQueueEvents.on).toHaveBeenCalledWith("completed", expect.anything());
    });

    it("Deve chamar o método 'completeScanIfFinished' quando o event 'failed' for chamado.", async () => {
      const completeSpy = jest.spyOn(scanService as any, "completeScanIfFinished").mockResolvedValue(undefined);

      scanService.onModuleInit();

      const callback = mockSourcesQueueEvents.on.mock.calls.find(([event]) => event === "failed")?.[1] as (props: {
        jobId: string;
      }) => void;

      jest.spyOn(Job, "fromId").mockResolvedValue({ data: { nickname: "test" } } as Job);

      callback({ jobId: "jobId" });

      await Promise.resolve();

      expect(Job.fromId).toHaveBeenCalledWith(mockSourcesQueue, "jobId");
      expect(completeSpy).toHaveBeenCalledWith("test");
    });

    it("Deve chamar o método 'completeScanIfFinished' quando o event 'completed' for chamado.", async () => {
      const completeSpy = jest.spyOn(scanService as any, "completeScanIfFinished").mockResolvedValue(undefined);

      scanService.onModuleInit();

      const callback = mockSourcesQueueEvents.on.mock.calls.find(([event]) => event === "completed")?.[1] as (props: {
        jobId: string;
      }) => void;

      jest.spyOn(Job, "fromId").mockResolvedValue({ data: { nickname: "test" } } as Job);

      callback({ jobId: "jobId" });

      await Promise.resolve();

      expect(Job.fromId).toHaveBeenCalledWith(mockSourcesQueue, "jobId");
      expect(completeSpy).toHaveBeenCalledWith("test");
    });
  });

  describe("ScanService.findStatusNickname", () => {
    it("Deve retornar o 'scan' e os 'sources' quando o 'scan' existir.", async () => {
      const scan = { nickname: "test", status: "pending", createdAt: "now", startedAt: "now", completedAt: null };
      const sources = { github: { sourceId: "github", status: "pending" } };

      mockScanRepository.findScan.mockResolvedValue(scan as any);
      mockSourceScanRepository.findSourceScans.mockResolvedValue(sources as any);

      const result = await scanService.findStatusNickname("test");

      expect(result).toEqual({ scan, sources });
    });

    it("Deve retornar 'null' quando o 'scan' não existir.", async () => {
      mockScanRepository.findScan.mockResolvedValue(null);

      const result = await scanService.findStatusNickname("test");

      expect(result).toBeNull();
    });
  });
});
