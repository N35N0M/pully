import { PlatformMethods } from "./index.ts";


export interface GithubAdapter {
	GITHUB_TOKEN: string;
	GITHUB_REPOSITORY: string;
	GITHUB_REPOSITORY_OWNER: string;
	platform_methods: PlatformMethods;
}
