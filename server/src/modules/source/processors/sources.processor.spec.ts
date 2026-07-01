import { ScanRepository } from "@/modules/scan/repositories/scan.repository";
import { SourceScanRepository } from "../repositories/sourceScan.repository";
import { LockService } from "@/modules/redis/services/lock.service";
import { SourcesProcessor } from "./sources.processor";
import { SourcesRegistry } from "../sources.registry";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Job } from "bullmq";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

describe("ScanProcessor", () => {
  const mockSourceScanRepository = mockDeep<SourceScanRepository>();
  const mockSourcesRegistry = mockDeep<SourcesRegistry>();
  const mockScanRepository = mockDeep<ScanRepository>();
  const mockLockService = mockDeep<LockService>();

  let sourcesProcessor: SourcesProcessor;

  const job = { name: "github", data: { nickname: "test" } } as Job<{ nickname: string }>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SourcesProcessor,
        { provide: SourceScanRepository, useValue: mockSourceScanRepository },
        { provide: SourcesRegistry, useValue: mockSourcesRegistry },
        { provide: ScanRepository, useValue: mockScanRepository },
        { provide: LockService, useValue: mockLockService },
      ],
    }).compile();

    sourcesProcessor = moduleRef.get(SourcesProcessor);

    jest.resetAllMocks();
  });

  describe("ScanProcessor.process", () => {
    it("Deve ignorar o processamento quando o lock não for adquirido.", async () => {
      mockLockService.withLock.mockImplementation(async () => {});
      mockSourcesRegistry.get.mockReturnValue({ sourceId: SourceId.GitHub, sourceName: "Github" } as any);

      await sourcesProcessor.process(job);

      expect(mockSourceScanRepository.findSourceScan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToCompleted).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToFailed).not.toHaveBeenCalled();
    });

    it("Deve ignorar quando o 'source' estiver desativada.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.get.mockReturnValue({
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        profileUrl: () => "https://github.com/test",
      } as any);
      mockSourcesRegistry.isDisabled.mockReturnValue(true);

      await sourcesProcessor.process(job);

      expect(mockSourcesRegistry.isDisabled).toHaveBeenCalledWith(SourceId.GitHub);
      expect(mockSourceScanRepository.findSourceScan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
    });

    it("Deve ignorar quando o 'source scan' existente já estiver pendente.", async () => {
      const mockScan = jest.fn();

      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue({ status: "pending" } as any);
      mockSourcesRegistry.get.mockReturnValue({
        profileUrl: () => "https://github.com/test",
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        scan: mockScan,
      } as any);
      mockSourcesRegistry.isDisabled.mockReturnValue(false);

      await sourcesProcessor.process(job);

      expect(mockScan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToPending).not.toHaveBeenCalled();
    });

    it("Deve ignorar quando o 'source scan' existente tiver cache válido.", async () => {
      const mockScan = jest.fn();

      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.get.mockReturnValue({
        profileUrl: () => "https://github.com/test",
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        scan: mockScan,
      } as any);
      mockSourceScanRepository.findSourceScan.mockResolvedValue({
        cacheExpiresAt: new Date().getTime() + 24 * 60 * 60 * 1000,
        status: "found",
      } as any);

      await sourcesProcessor.process(job);

      expect(mockScan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToPending).not.toHaveBeenCalled();
    });

    it("Deve atualizar para pendente e executar o 'scan' quando o cache estiver inválido.", async () => {
      const mockScan = jest.fn().mockResolvedValue({ status: "found" });
      const sourceClass = {
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        profileUrl: jest.fn().mockReturnValue("https://github.com/test"),
        scan: mockScan,
        cacheExpiresInMs: 3600000,
      };

      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.get.mockReturnValue(sourceClass);
      mockSourcesRegistry.isDisabled.mockReturnValue(false);
      mockSourceScanRepository.findSourceScan.mockResolvedValue({
        status: "found",
        cacheExpiresAt: new Date().getTime() - 24 * 60 * 60 * 1000,
      } as any);
      mockSourceScanRepository.updateToPending.mockResolvedValue({ status: "pending" } as any);

      await sourcesProcessor.process(job);

      expect(mockSourceScanRepository.updateToPending).toHaveBeenCalledWith("test", SourceId.GitHub);
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockScan).toHaveBeenCalledWith("test");
      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalled();
    });

    it("Deve criar pendente e executar o 'scan' quando não houver 'source scan' existente.", async () => {
      const mockScan = jest.fn().mockResolvedValue({ status: "found" });
      const sourceClass = {
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        profileUrl: jest.fn().mockReturnValue("https://github.com/test"),
        scan: mockScan,
        cacheExpiresInMs: 3600000,
      };

      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.get.mockReturnValue(sourceClass);
      mockSourcesRegistry.isDisabled.mockReturnValue(false);
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({ status: "pending" } as any);

      await sourcesProcessor.process(job);

      expect(mockSourceScanRepository.createPending).toHaveBeenCalledWith({
        profileUrl: "https://github.com/test",
        sourceName: "Github",
        nickname: "test",
        sourceId: SourceId.GitHub,
      });
      expect(mockSourceScanRepository.updateToPending).not.toHaveBeenCalled();
      expect(mockScan).toHaveBeenCalledWith("test");
      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalled();
    });

    it("Deve chamar 'updateToCompleted' com 'found=true' quando o 'scan' for bem-sucedido com 'found'.", async () => {
      const mockScan = jest.fn().mockResolvedValue({ status: "found" });
      const sourceClass = {
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        profileUrl: jest.fn().mockReturnValue("https://github.com/test"),
        scan: mockScan,
        cacheExpiresInMs: 3600000,
      };

      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.get.mockReturnValue(sourceClass);
      mockSourcesRegistry.isDisabled.mockReturnValue(false);
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({ status: "pending" } as any);

      await sourcesProcessor.process(job);

      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalledWith({
        cacheExpiresInMs: 3600000,
        found: true,
        sourceId: SourceId.GitHub,
        nickname: "test",
      });
      expect(mockSourceScanRepository.updateToFailed).not.toHaveBeenCalled();
    });

    it("Deve chamar 'updateToCompleted' com 'found=false' quando o 'scan' retornar 'not_found'.", async () => {
      const mockScan = jest.fn().mockResolvedValue({ status: "not_found" });
      const sourceClass = {
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        profileUrl: jest.fn().mockReturnValue("https://github.com/test"),
        scan: mockScan,
        cacheExpiresInMs: 3600000,
      };

      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.get.mockReturnValue(sourceClass);
      mockSourcesRegistry.isDisabled.mockReturnValue(false);
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({ status: "pending" } as any);

      await sourcesProcessor.process(job);

      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalledWith({
        cacheExpiresInMs: 3600000,
        found: false,
        sourceId: SourceId.GitHub,
        nickname: "test",
      });
      expect(mockSourceScanRepository.updateToFailed).not.toHaveBeenCalled();
    });

    it("Deve chamar 'updateToFailed' quando o 'executeScan' lançar um erro.", async () => {
      const scanError = new Error("Network timeout");
      const mockScan = jest.fn().mockRejectedValue(scanError);
      const sourceClass = {
        sourceId: SourceId.GitHub,
        sourceName: "Github",
        profileUrl: jest.fn().mockReturnValue("https://github.com/test"),
        scan: mockScan,
        cacheExpiresInMs: 3600000,
      };

      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<unknown>) => callback());
      mockSourcesRegistry.get.mockReturnValue(sourceClass);
      mockSourcesRegistry.isDisabled.mockReturnValue(false);
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({ status: "pending" } as any);

      await sourcesProcessor.process(job);

      expect(mockSourceScanRepository.updateToFailed).toHaveBeenCalledWith({
        error: "Network timeout",
        sourceId: SourceId.GitHub,
        nickname: "test",
      });
      expect(mockSourceScanRepository.updateToCompleted).not.toHaveBeenCalled();
    });
  });
});
