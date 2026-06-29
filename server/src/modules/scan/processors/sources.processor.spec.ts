import { SourceScanRepository } from "../repositories/sourceScan.repository";
import { ScanRepository } from "../repositories/scan.repository";
import { LockService } from "../services/lock.service";
import { ScanProcessor } from "./sources.processor";
import { ConfigService } from "@nestjs/config";
import { BaseSource } from "../scan.type";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Job } from "bullmq";

jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});

jest.mock("../sources.registry", () => [createMockSource()]);

function createMockSource(): BaseSource {
  return {
    sourceId: "github",
    sourceName: "Github",
    cacheExpiresInMs: 1000,
    profileUrl: () => "https://github.com/test",
    scan: jest.fn(),
  } as unknown as BaseSource;
}

describe("ScanProcessor", () => {
  const mockSourceScanRepository = {
    findSourceScan: jest.fn(),
    findSourceScans: jest.fn(),
    createPending: jest.fn(),
    updateToPending: jest.fn(),
    updateToCompleted: jest.fn(),
    updateToFailed: jest.fn(),
  };

  const mockScanRepository = {
    updateToComplete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLockService = {
    withLock: jest.fn(),
    acquire: jest.fn(),
    release: jest.fn(),
  };

  let scanProcessor: ScanProcessor;

  const job = { name: "github", data: { nickname: "test" } } as Job<{ nickname: string }>;

  function createFutureDate(): string {
    return new Date(Date.now() + 3600000).toUTCString();
  }

  function createPastDate(): string {
    return new Date(Date.now() - 3600000).toUTCString();
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScanProcessor,
        { provide: SourceScanRepository, useValue: mockSourceScanRepository },
        { provide: ScanRepository, useValue: mockScanRepository },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LockService, useValue: mockLockService },
      ],
    }).compile();

    scanProcessor = moduleRef.get(ScanProcessor);

    jest.resetAllMocks();

    mockLockService.acquire.mockResolvedValue(true);
    mockLockService.release.mockResolvedValue(undefined);
    mockSourceScanRepository.findSourceScans.mockResolvedValue({});
    mockConfigService.get.mockReturnValue("");
  });

  describe("ScanProcessor.process", () => {
    it("should skip processing when lock is not acquired. | Deve ignorar o processamento quando o lock não for adquirido.", async () => {
      mockLockService.withLock.mockImplementation(async () => {});

      await scanProcessor.process(job);

      expect(mockSourceScanRepository.findSourceScan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToCompleted).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToFailed).not.toHaveBeenCalled();
    });

    it("should skip when source is deactivated. | Deve ignorar quando a fonte estiver desativada.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      scanProcessor["sourcesDeactivated"].add("github");

      await scanProcessor.process(job);

      expect(mockSourceScanRepository.findSourceScan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
    });

    it("should skip when existing source scan is already pending. | Deve ignorar quando o 'source scan' existente já estiver pendente.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue({ status: "pending" } as any);

      const mockSource = scanProcessor["sources"].get("github")!;

      await scanProcessor.process(job);

      expect(mockSource.scan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToPending).not.toHaveBeenCalled();
    });

    it("should skip when existing source scan has valid cache. | Deve ignorar quando o 'source scan' existente tiver cache válido.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue({
        status: "found",
        cacheExpiresAt: createFutureDate(),
      } as any);

      const mockSource = scanProcessor["sources"].get("github")!;

      await scanProcessor.process(job);

      expect(mockSource.scan).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.createPending).not.toHaveBeenCalled();
      expect(mockSourceScanRepository.updateToPending).not.toHaveBeenCalled();
    });

    it("should update to pending and execute scan when cache is invalid. | Deve atualizar para pendente e executar o 'scan' quando o cache estiver inválido.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue({
        status: "found",
        cacheExpiresAt: createPastDate(),
      } as any);
      mockSourceScanRepository.updateToPending.mockResolvedValue({ status: "pending" } as any);
      mockSourceScanRepository.updateToCompleted.mockResolvedValue({} as any);

      const mockSource = scanProcessor["sources"].get("github")!;
      (mockSource.scan as jest.Mock).mockResolvedValue({ status: "found" });

      await scanProcessor.process(job);

      expect(mockSourceScanRepository.updateToPending).toHaveBeenCalledWith("test", "github");
      expect(mockSource.scan).toHaveBeenCalledWith("test");
      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalledWith({
        cacheExpiresInMs: 1000,
        found: true,
        sourceId: "github",
        nickname: "test",
      });
    });

    it("should create pending and execute scan when no existing source scan. | Deve criar pendente e executar o 'scan' quando não houver 'source scan' existente.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({ status: "pending" } as any);
      mockSourceScanRepository.updateToCompleted.mockResolvedValue({} as any);

      const mockSource = scanProcessor["sources"].get("github")!;
      (mockSource.scan as jest.Mock).mockResolvedValue({ status: "found" });

      await scanProcessor.process(job);

      expect(mockSourceScanRepository.createPending).toHaveBeenCalledWith({
        profileUrl: "https://github.com/test",
        sourceName: "Github",
        nickname: "test",
        sourceId: "github",
      });
      expect(mockSource.scan).toHaveBeenCalledWith("test");
      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalledWith({
        cacheExpiresInMs: 1000,
        found: true,
        sourceId: "github",
        nickname: "test",
      });
    });

    it("should call updateToCompleted with found=true when scan succeeds with found. | Deve chamar 'updateToCompleted' com 'found=true' quando o 'scan' for bem-sucedido com 'found'.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({} as any);
      mockSourceScanRepository.updateToCompleted.mockResolvedValue({} as any);

      const mockSource = scanProcessor["sources"].get("github")!;
      (mockSource.scan as jest.Mock).mockResolvedValue({ status: "found" });

      await scanProcessor.process(job);

      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalledWith(expect.objectContaining({ found: true }));
    });

    it("should call updateToCompleted with found=false when scan returns not_found. | Deve chamar 'updateToCompleted' com 'found=false' quando o 'scan' retornar 'not_found'.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({} as any);
      mockSourceScanRepository.updateToCompleted.mockResolvedValue({} as any);

      const mockSource = scanProcessor["sources"].get("github")!;
      (mockSource.scan as jest.Mock).mockResolvedValue({ status: "not_found" });

      await scanProcessor.process(job);

      expect(mockSourceScanRepository.updateToCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ found: false }),
      );
    });

    it("should call updateToFailed when executeScan throws. | Deve chamar 'updateToFailed' quando o 'executeScan' lançar um erro.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({} as any);
      mockSourceScanRepository.updateToFailed.mockResolvedValue({} as any);

      const mockSource = scanProcessor["sources"].get("github")!;
      (mockSource.scan as jest.Mock).mockRejectedValue(new Error("API error"));

      await scanProcessor.process(job);

      expect(mockSourceScanRepository.updateToFailed).toHaveBeenCalledWith({
        error: "API error",
        sourceId: "github",
        nickname: "test",
      });
    });

    it("should complete scan when all sources are finished. | Deve completar o 'scan' quando todas as fontes estiverem finalizadas.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({} as any);
      mockSourceScanRepository.updateToCompleted.mockResolvedValue({} as any);
      mockSourceScanRepository.findSourceScans.mockResolvedValue({
        github: { status: "found" },
      } as any);

      const mockSource = scanProcessor["sources"].get("github")!;
      (mockSource.scan as jest.Mock).mockResolvedValue({ status: "found" });

      await scanProcessor.process(job);

      expect(mockScanRepository.updateToComplete).toHaveBeenCalledWith("test");
    });

    it("should not complete scan when some sources are still pending. | Não deve completar o 'scan' quando algumas fontes ainda estiverem pendentes.", async () => {
      mockLockService.withLock.mockImplementation(async (_key, _ttl, callback: () => Promise<void>) => callback());
      mockSourceScanRepository.findSourceScan.mockResolvedValue(null);
      mockSourceScanRepository.createPending.mockResolvedValue({} as any);
      mockSourceScanRepository.updateToCompleted.mockResolvedValue({} as any);
      mockSourceScanRepository.findSourceScans.mockResolvedValue({
        github: { status: "pending" },
      } as any);

      const mockSource = scanProcessor["sources"].get("github")!;
      (mockSource.scan as jest.Mock).mockResolvedValue({ status: "found" });

      await scanProcessor.process(job);

      expect(mockScanRepository.updateToComplete).not.toHaveBeenCalled();
    });
  });
});
