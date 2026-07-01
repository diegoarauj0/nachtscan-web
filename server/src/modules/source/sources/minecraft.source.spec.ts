import { MinecraftSource } from "./minecraft.source";
import { SourceId } from "../source.type";
import { USER_AGENT } from "../sources.constants";

describe("MinecraftSource", () => {
  let minecraftSource: MinecraftSource;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();

    minecraftSource = new MinecraftSource();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("MinecraftSource.onInit", () => {
    it("Deve retornar true.", () => {
      expect(minecraftSource.onInit()).toBe(true);
    });
  });

  describe("MinecraftSource.profileUrl", () => {
    it("Deve gerar a URL do perfil do Minecraft corretamente.", () => {
      expect(minecraftSource.profileUrl("octocat")).toBe("https://pt.namemc.com/profile/octocat");
    });
  });

  describe("propriedades", () => {
    it("Deve ter o sourceId e sourceName corretos.", () => {
      expect(minecraftSource.sourceId).toBe(SourceId.Minecraft);
      expect(minecraftSource.sourceName).toBe("Minecraft");
    });
  });

  describe("MinecraftSource.scan", () => {
    it("Deve retornar status 'found' quando a API responder com 200.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      const result = await minecraftSource.scan("octocat");

      expect(result).toEqual({ status: "found" });
    });

    it("Deve retornar status 'not_found' quando a API responder com 404.", async () => {
      fetchSpy.mockResolvedValue({ status: 404 });

      const result = await minecraftSource.scan("octocat");

      expect(result).toEqual({ status: "not_found" });
    });

    it("Deve lançar um erro quando a API responder com um status inesperado.", async () => {
      fetchSpy.mockResolvedValue({ status: 500 });

      await expect(minecraftSource.scan("octocat")).rejects.toThrow("Mojang API request failed with status 500.");
    });

    it("Deve chamar a API do Mojang com a URL correta, codificando o nickname.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await minecraftSource.scan("octo cat");

      expect(fetchSpy).toHaveBeenCalledWith("https://api.mojang.com/users/profiles/minecraft/octo%20cat", expect.any(Object));
    });

    it("Deve enviar os headers 'Accept' e 'User-Agent' em toda requisição.", async () => {
      fetchSpy.mockResolvedValue({ status: 200 });

      await minecraftSource.scan("octocat");

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options.headers as Headers;

      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("User-Agent")).toBe(USER_AGENT);
    });
  });
});
