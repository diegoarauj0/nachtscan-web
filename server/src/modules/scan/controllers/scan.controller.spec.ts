import { NotFoundException, BadRequestException } from "@nestjs/common";
import { ScanService } from "../services/scan.service";
import { ScanController } from "./scan.controller";
import { Test } from "@nestjs/testing";

describe("ScanController", () => {
  const mockScanService = {
    scanNickname: jest.fn(),
    findStatusNickname: jest.fn(),
  };

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
    it("Should call scanService.scanNickname with the nickname. | Deve chamar scanService.scanNickname com o nickname.", () => {
      scanController.scanNickname("octocat");

      expect(mockScanService.scanNickname).toHaveBeenCalledWith("octocat");
    });

    it("Should not return anything. | Não deve retornar nada.", () => {
      const result = scanController.scanNickname("octocat");

      expect(result).toBeUndefined();
    });

    it("Should throw 'BadRequestException' when nickname is empty. | Deve lançar um 'BadRequestException' quando o nickname estiver vazio.", () => {
      expect(() => scanController.scanNickname("")).toThrow(BadRequestException);
    });

    it("Should throw 'BadRequestException' when nickname is undefined. | Deve lançar 'BadRequestException' quando o nickname não estiver definido.", () => {
      expect(() => scanController.scanNickname(undefined as unknown as string)).toThrow(BadRequestException);
    });
  });

  describe("ScanController.findStatusNickname", () => {
    it("Should return scan and sources when scan exists. | Deve retornar o 'scan' e as 'sources' quando encontrado.", async () => {
      const expected = {
        scan: { nickname: "octocat", status: "pending" },
        sources: { github: { sourceId: "github", status: "pending" } },
      };

      mockScanService.findStatusNickname.mockResolvedValue(expected);

      const result = await scanController.findStatusNickname("octocat");

      expect(result).toEqual(expected);
    });

    it("Should throw NotFoundException when scan does not exist. | Deve lançar um 'NotFoundException' quando o 'scan' não for encontrado.", async () => {
      mockScanService.findStatusNickname.mockResolvedValue(null);

      await expect(scanController.findStatusNickname("octocat")).rejects.toThrow(NotFoundException);
    });

    it("Should throw BadRequestException when nickname is empty. | Deve lançar um 'BadRequestException' quando o 'nickname' estiver vazio.", async () => {
      await expect(scanController.findStatusNickname("")).rejects.toThrow(BadRequestException);
    });

    it("Should throw BadRequestException when nickname is undefined. | deve lançar um 'BadRequestException' quando o 'nickname' não estiver definido.", async () => {
      await expect(scanController.findStatusNickname(undefined as unknown as string)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
