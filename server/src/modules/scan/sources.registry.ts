import { GithubSource } from "./sources/github.source";
import { BaseSource } from "./scan.type";

export default [new GithubSource()] as BaseSource[];
