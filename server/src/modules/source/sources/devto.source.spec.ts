import { DevToSource } from "./devto.source";
import { ConfigService } from "@nestjs/config";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";

describe("DevToSource", () => {
  const mockConfigService = mockDeep<ConfigService>();

  let devtoSource: DevToSource;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();

    devtoSource = new DevToSource(mockConfigService);
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("DevToSource.onInit", () => {
    it("Deve retornar true.", () => {
      expect(devtoSource.onInit()).toBe(true);
    });
  });

  describe("DevToSource.profileUrl", () => {
    it("Deve gerar a URL do perfil do Dev.to corretamente.", () => {
      expect(devtoSource.profileUrl("octocat")).toBe("https://dev.to/octocat");
    });
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(devtoSource.sourceId).toBe(SourceId.DevTo);
      expect(devtoSource.sourceName).toBe("Dev.to");
    });
  });

  describe("DevToSource.scan", () => {
    it("Deve retornar status 'found' quando a API responder com 200.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      const result = await devtoSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar status 'not_found' quando a API responder com 404.", async () => {
      fetchSpy.mockResolvedValue({ status: 404 });

      const result = await devtoSource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status inesperado.", async () => {
      fetchSpy.mockResolvedValue({ status: 500 });

      await expect(devtoSource.scan("octocat")).rejects.toThrow("Dev.to API request failed with status 500.");
    });

    it("Deve chamar a API do Dev.to com a URL correta, codificando o nickname.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await devtoSource.scan("octo cat");

      expect(fetchSpy).toHaveBeenCalledWith("https://dev.to/api/users/by_username?url=octo%20cat", expect.any(Object));
    });

    it("Deve enviar os headers 'Accept' e 'User-Agent' em toda requisição.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await devtoSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Accept")).toBe("application/vnd.forem.api-v1+json");
      expect(headers.get("User-Agent")).toBe(USER_AGENT);
    });

    it("Deve incluir o header 'api-key' quando houver um token configurado.", async () => {
      mockConfigService.get.mockReturnValue("my-token");
      fetchSpy.mockResolvedValue({ status: 200 });

      await devtoSource.scan("octocat");

      expect(mockConfigService.get).toHaveBeenCalledWith("DEVTO_TOKEN");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("api-key")).toBe("my-token");
    });

    it("Não deve incluir o header 'api-key' quando não houver token configurado.", async () => {
      mockConfigService.get.mockReturnValue(undefined);
      fetchSpy.mockResolvedValue({ status: 200 });

      await devtoSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("api-key")).toBeNull();
    });
  });
});
