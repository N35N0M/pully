import { AuthorInfo } from "./AuthorInfo.ts";


export const getAuthorInfoFromGithubLogin = (
	authorInfos: AuthorInfo[],
	githubLogin: string
): AuthorInfo => {
	const search = authorInfos.find(
		(value) => value.githubUsername === githubLogin
	);

	if (search) {
		return search;
	}

	return {
		githubUsername: githubLogin,
		slackMemberId: undefined,
		firstName: undefined,
		slackmoji: undefined,
	};
};
