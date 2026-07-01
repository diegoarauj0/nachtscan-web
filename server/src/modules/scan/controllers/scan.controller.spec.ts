import { NotFoundException, BadRequestException } from "@nestjs/common";
import { ScanService } from "../services/scan.service";
import { ScanController } from "./scan.controller";
import { mockDeep } from "jest-mock-extended";
import { Test } from "@nestjs/testing";

describe("ScanController", () => {
  const mockScanService = mockDeep<ScanService>();

  let scanController: ScanController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ScanController],
      providers: [{ provide: ScanService, useValue: mockScanService }],
    }).compile();

    scanController = moduleRef.get(ScanController);

    jest.resetAllMocks();
  });

  describe("ScanController.scanNickname", () => {
    it("Deve passar o nickname para o scanNickname.", () => {
      scanController.scanNickname("octocat");

      expect(mockScanService.scanNickname).toHaveBeenCalledWith("octocat");
    });

    it("Não deve retornar nada.", () => {
      const result = scanController.scanNickname("octocat");

      expect(result).toBeUndefined();
    });

    it("Deve lançar um 'BadRequestException' quando o nickname estiver vazio.", () => {
      expect(() => scanController.scanNickname("")).toThrow(BadRequestException);
    });

    it("Deve lançar 'BadRequestException' quando o nickname não estiver definido.", () => {
      expect(() => scanController.scanNickname(undefined as unknown as string)).toThrow(BadRequestException);
    });
  });

  describe("ScanController.findStatusNickname", () => {
    it("Deve retornar o 'scan' e as 'sources' quando encontrado.", async () => {
      const expected = {
        scan: { nickname: "octocat", status: "pending" },
        sources: { github: { sourceId: "github", status: "pending" } },
      };

      mockScanService.findStatusNickname.mockResolvedValue(expected as any);

      const result = await scanController.findStatusNickname("octocat");

      expect(result).toEqual(expected);
    });

    it("Deve lançar um 'NotFoundException' quando o 'scan' não for encontrado.", async () => {
      mockScanService.findStatusNickname.mockResolvedValue(null);

      await expect(scanController.findStatusNickname("octocat")).rejects.toThrow(NotFoundException);
    });

    it("Deve lançar um 'BadRequestException' quando o 'nickname' estiver vazio.", async () => {
      await expect(scanController.findStatusNickname("")).rejects.toThrow(BadRequestException);
    });

    it("Deve lançar um 'BadRequestException' quando o 'nickname' não estiver definido.", async () => {
      await expect(scanController.findStatusNickname(undefined as unknown as string)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
