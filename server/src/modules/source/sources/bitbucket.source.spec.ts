import { BitbucketSource } from "./bitbucket.source";
import { ConfigService } from "@nestjs/config";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";

describe("BitbucketSource", () => {
  const mockConfigService = mockDeep<ConfigService>();

  let bitbucketSource: BitbucketSource;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();

    bitbucketSource = new BitbucketSource(mockConfigService);
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("BitbucketSource.onInit", () => {
    it("Deve retornar true.", () => {
      expect(bitbucketSource.onInit()).toBe(true);
    });
  });

  describe("BitbucketSource.profileUrl", () => {
    it("Deve gerar a URL do perfil do Bitbucket corretamente.", () => {
      expect(bitbucketSource.profileUrl("octocat")).toBe("https://bitbucket.org/octocat");
    });
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(bitbucketSource.sourceId).toBe(SourceId.BitBucket);
      expect(bitbucketSource.sourceName).toBe("Bitbucket");
    });
  });

  describe("BitbucketSource.scan", () => {
    it("Deve retornar status 'found' quando a API responder com 200.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      const result = await bitbucketSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar status 'not_found' quando a API responder com 404.", async () => {
      fetchSpy.mockResolvedValue({ status: 404 });

      const result = await bitbucketSource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status inesperado.", async () => {
      fetchSpy.mockResolvedValue({ status: 500 });

      await expect(bitbucketSource.scan("octocat")).rejects.toThrow("Bitbucket API request failed with status 500.");
    });

    it("Deve chamar a API do Bitbucket com a URL correta, codificando o nickname.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await bitbucketSource.scan("octo cat");

      expect(fetchSpy).toHaveBeenCalledWith("https://api.bitbucket.org/2.0/users/octo%20cat", expect.any(Object));
    });

    it("Deve enviar os headers 'Accept' e 'User-Agent' em toda requisição.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await bitbucketSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("User-Agent")).toBe(USER_AGENT);
    });

    it("Deve incluir o header 'Authorization' quando houver um token configurado.", async () => {
      mockConfigService.get.mockReturnValue("my-token");
      fetchSpy.mockResolvedValue({ status: 200 });

      await bitbucketSource.scan("octocat");

      expect(mockConfigService.get).toHaveBeenCalledWith("BITBUCKET_TOKEN");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("Não deve incluir o header 'Authorization' quando não houver token configurado.", async () => {
      mockConfigService.get.mockReturnValue(undefined);
      fetchSpy.mockResolvedValue({ status: 200 });

      await bitbucketSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBeNull();
    });
  });
});
