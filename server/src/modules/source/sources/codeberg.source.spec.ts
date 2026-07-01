import { CodebergSource } from "./codeberg.source";
import { ConfigService } from "@nestjs/config";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";

describe("CodebergSource", () => {
  const mockConfigService = mockDeep<ConfigService>();

  let codebergSource: CodebergSource;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();

    codebergSource = new CodebergSource(mockConfigService);
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("CodebergSource.onInit", () => {
    it("Deve retornar true.", () => {
      expect(codebergSource.onInit()).toBe(true);
    });
  });

  describe("CodebergSource.profileUrl", () => {
    it("Deve gerar a URL do perfil do Codeberg corretamente.", () => {
      expect(codebergSource.profileUrl("octocat")).toBe("https://codeberg.org/octocat");
    });
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(codebergSource.sourceId).toBe(SourceId.CodeBerg);
      expect(codebergSource.sourceName).toBe("Codeberg");
    });
  });

  describe("CodebergSource.scan", () => {
    it("Deve retornar status 'found' quando a API responder com 200.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      const result = await codebergSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar status 'not_found' quando a API responder com 404.", async () => {
      fetchSpy.mockResolvedValue({ status: 404 });

      const result = await codebergSource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status inesperado.", async () => {
      fetchSpy.mockResolvedValue({ status: 500 });

      await expect(codebergSource.scan("octocat")).rejects.toThrow("Codeberg API request failed with status 500.");
    });

    it("Deve chamar a API do Codeberg com a URL correta, codificando o nickname.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await codebergSource.scan("octo cat");

      expect(fetchSpy).toHaveBeenCalledWith("https://codeberg.org/api/v1/users/octo%20cat", expect.any(Object));
    });

    it("Deve enviar os headers 'Accept' e 'User-Agent' em toda requisição.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await codebergSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("User-Agent")).toBe(USER_AGENT);
    });

    it("Deve incluir o header 'Authorization' quando houver um token configurado.", async () => {
      mockConfigService.get.mockReturnValue("my-token");
      fetchSpy.mockResolvedValue({ status: 200 });

      await codebergSource.scan("octocat");

      expect(mockConfigService.get).toHaveBeenCalledWith("CODEBERG_TOKEN");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("Não deve incluir o header 'Authorization' quando não houver token configurado.", async () => {
      mockConfigService.get.mockReturnValue(undefined);
      fetchSpy.mockResolvedValue({ status: 200 });

      await codebergSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBeNull();
    });
  });
});
