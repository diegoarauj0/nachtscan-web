import { GithubSource } from "./sources/github.source";
import { GitlabSource } from "./sources/gitlab.source";
import { BitbucketSource } from "./sources/bitbucket.source";
import { CodebergSource } from "./sources/codeberg.source";
import { OsuSource } from "./sources/osu.source";
import { SteamSource } from "./sources/steam.source";
import { DevToSource } from "./sources/devto.source";
import { MinecraftSource } from "./sources/minecraft.source";
import { MastodonSource } from "./sources/mastodon.source";
import { BlueskySource } from "./sources/bluesky.source";
import { BaseSource } from "./scan.type";

interface InterfaceCreateSourceRegistryProps {
  codebergToken?: string | undefined;
  githubToken?: string | undefined;
  gitlabToken?: string | undefined;
  bitbucketToken?: string | undefined;
  osuClientId?: string | undefined;
  osuClientSecret?: string | undefined;
  steamApiKey?: string | undefined;
  devtoApiKey?: string | undefined;
  mastodonClientKey?: string | undefined;
  mastodonClientSecret?: string | undefined;
  mastodonAuthorizationCode?: string | undefined;
}

export function createSourceRegistry(props: InterfaceCreateSourceRegistryProps): Array<BaseSource> {
  const {
    codebergToken,
    githubToken,
    bitbucketToken: bitbucket,
    gitlabToken,
    osuClientId,
    osuClientSecret,
    steamApiKey,
    devtoApiKey,
    mastodonClientKey,
    mastodonClientSecret,
    mastodonAuthorizationCode,
  } = props;

  return [
    new GithubSource(githubToken),
    new GitlabSource(gitlabToken),
    new BitbucketSource(bitbucket),
    new CodebergSource(codebergToken),
    new OsuSource(osuClientId, osuClientSecret),
    new SteamSource(steamApiKey),
    new DevToSource(devtoApiKey),
    new MinecraftSource(),
    new MastodonSource(mastodonClientKey, mastodonClientSecret, mastodonAuthorizationCode),
    new BlueskySource(),
  ];
}
