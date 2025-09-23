export interface AuthorInfo {
	githubUsername?: string;
	slackMemberId?: string;
	firstName?: string;

	/**
	 * If set, should be one slackmoji to be posted alongside firstname,
	 * i.e. a string staring and ending with colon ":my-slackmoji:"
	 */
	slackmoji?: string;
}
