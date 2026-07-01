import { BlueskySource } from "./bluesky.source";
import { SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";

describe("BlueskySource", () => {
  let blueskySource: BlueskySource;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();

    blueskySource = new BlueskySource();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("BlueskySource.onInit", () => {
    it("Deve retornar true.", () => {
      expect(blueskySource.onInit()).toBe(true);
    });
  });

  describe("BlueskySource.profileUrl", () => {
    it("Deve gerar a URL do perfil do Bluesky corretamente.", () => {
      expect(blueskySource.profileUrl("octocat")).toBe("https://bsky.app/profile/octocat");
    });
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(blueskySource.sourceId).toBe(SourceId.Bluesky);
      expect(blueskySource.sourceName).toBe("Bluesky");
    });
  });

  describe("BlueskySource.scan", () => {
    it("Deve retornar status 'found' quando a API responder com 200.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      const result = await blueskySource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar status 'not_found' quando a API responder com 400.", async () => {
      fetchSpy.mockResolvedValue({ status: 400 });

      const result = await blueskySource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status inesperado.", async () => {
      fetchSpy.mockResolvedValue({ status: 500 });

      await expect(blueskySource.scan("octocat")).rejects.toThrow("Bluesky API request failed with status 500.");
    });

    it("Deve chamar a API do Bluesky com a URL correta, codificando o nickname.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await blueskySource.scan("octo cat");

      expect(fetchSpy).toHaveBeenCalledWith(
        new URL("https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=octo+cat"),
        expect.any(Object),
      );
    });

    it("Deve remover o prefixo '@' do nickname ao chamar a API.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await blueskySource.scan("@octocat");

      expect(fetchSpy).toHaveBeenCalledWith(
        new URL("https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=octocat"),
        expect.any(Object),
      );
    });

    it("Deve enviar os headers 'Accept' e 'User-Agent' em toda requisição.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await blueskySource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("User-Agent")).toBe(USER_AGENT);
    });
  });
});
