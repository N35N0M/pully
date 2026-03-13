import { assertEquals } from "jsr:@std/assert";
import { constructSlackMessage } from "./constructSlackMessage.ts";
import { GithubAdapter } from "./GithubAdapter.ts";
import { PullyData } from "./PullyData.ts";
import { PullyOptions } from "./PullyOptions.ts";
import { AuthorInfo } from "./AuthorInfo.ts";

const pullyData: PullyData = { known_authors: [] };

const pullyOptions: PullyOptions = {
	PULLY_SLACK_TOKEN: "token",
	PULLY_SLACK_CHANNEL: "channel",
	PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE: false,
};

const makeAdapter = (): GithubAdapter => ({
	GITHUB_TOKEN: "token",
	GITHUB_REPOSITORY: "repo",
	GITHUB_REPOSITORY_OWNER: "owner",
	platform_methods: {
		getPrReviews: async () => [],
		getReviewsRequestedForPr: async () => [],
		getExistingMessageTimestamp: async () => undefined,
		updateSlackMessageTimestampForPr: async () => undefined,
		loadPullyUserConfig: async () => pullyData,
	},
});

Deno.test("slackmoji is included with a space when set", async () => {
	const author: AuthorInfo = {
		githubUsername: "alice",
		firstName: "Alice",
		slackmoji: ":wave:",
	};

	const result = await constructSlackMessage(
		makeAdapter(),
		pullyOptions,
		pullyData,
		author,
		"My PR",
		1,
		"closed",
		"owner",
		"repo",
		"https://github.com/owner/repo/pull/1",
	);

	// Should contain " :wave:" (space before emoji)
	assertEquals(result.includes("Alice :wave:~"), true);
});

Deno.test("no trailing space after author name when slackmoji is undefined", async () => {
	const author: AuthorInfo = {
		githubUsername: "bob",
		firstName: "Bob",
		slackmoji: undefined,
	};

	const result = await constructSlackMessage(
		makeAdapter(),
		pullyOptions,
		pullyData,
		author,
		"My PR",
		2,
		"closed",
		"owner",
		"repo",
		"https://github.com/owner/repo/pull/2",
	);

	// "Bob" should not be followed by a trailing space before the next section separator or end
	assertEquals(result.includes("by Bob~"), true);
});
