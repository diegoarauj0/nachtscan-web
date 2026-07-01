import { USER_AGENT } from "../sources.constants";
import { GitlabSource } from "./gitlab.source";
import { ConfigService } from "@nestjs/config";
import { mockDeep } from "jest-mock-extended";
import { SourceId } from "../source.type";

describe("GitLabSource", () => {
  const mockConfigService = mockDeep<ConfigService>();

  let gitlabSource: GitlabSource;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();

    gitlabSource = new GitlabSource(mockConfigService);
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("GitLabSource.onInit", () => {
    it("Deve retornar true.", () => {
      expect(gitlabSource.onInit()).toBe(true);
    });
  });

  describe("GitLabSource.profileUrl", () => {
    it("Deve gerar a URL do perfil do GitLab corretamente.", () => {
      expect(gitlabSource.profileUrl("octocat")).toBe("https://gitlab.com/octocat");
    });
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(gitlabSource.sourceId).toBe(SourceId.GitLab);
      expect(gitlabSource.sourceName).toBe("Gitlab");
    });
  });

  describe("GitlabSource.scan", () => {
    it("Deve retornar status 'found' quando a API retornar ao menos um usuário.", async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue([{ id: 1, username: "octocat" }]),
      });

      const result = await gitlabSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar status 'not_found' quando a API retornar uma lista vazia.", async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      const result = await gitlabSource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status diferente de 200.", async () => {
      fetchSpy.mockResolvedValue({ status: 500 });

      await expect(gitlabSource.scan("octocat")).rejects.toThrow("GitLab API request failed with status 500.");
    });

    it("Deve lançar um erro quando a API responder com 404 (diferente do GitHub/Bitbucket, aqui não é 'not_found').", async () => {
      fetchSpy.mockResolvedValue({ status: 404 });

      await expect(gitlabSource.scan("octocat")).rejects.toThrow("GitLab API request failed with status 404.");
    });

    it("Deve chamar a API do GitLab com a URL correta, codificando o nickname.", async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      await gitlabSource.scan("octo cat");

      expect(fetchSpy).toHaveBeenCalledWith("https://gitlab.com/api/v4/users?username=octo%20cat", expect.any(Object));
    });

    it("Deve enviar os headers 'Accept' e 'User-Agent' em toda requisição.", async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      await gitlabSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("User-Agent")).toBe(USER_AGENT);
    });

    it("Deve incluir o header 'Authorization' quando houver um token configurado.", async () => {
      mockConfigService.get.mockReturnValue("my-token");
      fetchSpy.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      await gitlabSource.scan("octocat");

      expect(mockConfigService.get).toHaveBeenCalledWith("GITLAB_TOKEN");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("Não deve incluir o header 'Authorization' quando não houver token configurado.", async () => {
      mockConfigService.get.mockReturnValue(undefined);
      fetchSpy.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      await gitlabSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Authorization")).toBeNull();
    });
  });
});
