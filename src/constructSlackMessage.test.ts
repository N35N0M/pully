import { assertEquals } from "jsr:@std/assert";
import { constructSlackMessage } from "./constructSlackMessage.ts";
import { GithubAdapter } from "./GithubAdapter.ts";
import { PullyData } from "./PullyData.ts";
import { PullyOptions } from "./PullyOptions.ts";
import { AuthorInfo } from "./AuthorInfo.ts";
import { ReviewerState } from "./index.ts";

const pullyData: PullyData = { known_authors: [] };

const pullyOptions: PullyOptions = {
	PULLY_SLACK_TOKEN: "token",
	PULLY_SLACK_CHANNEL: "channel",
	PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE: false,
	PULLY_REVIEW_STATUS_ON_NEW_LINE: false,
};

const makeAdapter = (): GithubAdapter => ({
	GITHUB_TOKEN: "token",
	GITHUB_REPOSITORY: "repo",
	GITHUB_REPOSITORY_OWNER: "owner",
	platform_methods: {
		getPrTitle: async () => "My feature",
		getPrReviews: async () => [],
		getReviewsRequestedForPr: async () => [],
		getExistingMessageTimestamp: async () => undefined,
		updateSlackMessageTimestampForPr: async () => undefined,
		addReminderTimestampForPr: async () => {},
		getReminderTimestampsForPr: async () => [],
		clearReminderTimestampsForPr: async () => {},
		listOpenPrs: async () => [],
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

Deno.test("commenter is shown with speech bubble when reviewer only comments", async () => {
	const prAuthor: AuthorInfo = { githubUsername: "alice", firstName: "Alice" };
	const reviewer: AuthorInfo = { githubUsername: "bob", firstName: "Bob" };

	const pullyDataWithReviewer: PullyData = { known_authors: [reviewer] };

	const adapter: GithubAdapter = {
		...makeAdapter(),
		platform_methods: {
			...makeAdapter().platform_methods,
			getPrReviews: async () => [
				{ author: reviewer, time: new Date(), state: "commented" as ReviewerState },
			],
		},
	};

	const result = await constructSlackMessage(
		adapter,
		pullyOptions,
		pullyDataWithReviewer,
		prAuthor,
		"My PR",
		5,
		"open",
		"owner",
		"repo",
		"https://github.com/owner/repo/pull/5",
	);

	assertEquals(result, ":github-pr: <https://github.com/owner/repo/pull/5|[owner/repo]> My PR (#5)  by Alice | :speech_balloon: Bob ");
});

Deno.test("approval takes precedence over comment when reviewer comments then approves", async () => {
	const prAuthor: AuthorInfo = { githubUsername: "alice", firstName: "Alice" };
	const reviewer: AuthorInfo = { githubUsername: "bob", firstName: "Bob" };
	const pullyDataWithReviewer: PullyData = { known_authors: [reviewer] };

	const adapter: GithubAdapter = {
		...makeAdapter(),
		platform_methods: {
			...makeAdapter().platform_methods,
			getPrReviews: async () => [
				{ author: reviewer, time: new Date("2024-01-01T10:00:00Z"), state: "commented" as ReviewerState },
				{ author: reviewer, time: new Date("2024-01-01T11:00:00Z"), state: "approved" as ReviewerState },
			],
		},
	};

	const result = await constructSlackMessage(
		adapter, pullyOptions, pullyDataWithReviewer, prAuthor,
		"My PR", 6, "open", "owner", "repo",
		"https://github.com/owner/repo/pull/6",
	);

	assertEquals(result, ":github-pr: <https://github.com/owner/repo/pull/6|[owner/repo]> My PR (#6)  by Alice | :github-approve: Bob ");
});

Deno.test("approval takes precedence over comment when reviewer approves then comments", async () => {
	const prAuthor: AuthorInfo = { githubUsername: "alice", firstName: "Alice" };
	const reviewer: AuthorInfo = { githubUsername: "bob", firstName: "Bob" };
	const pullyDataWithReviewer: PullyData = { known_authors: [reviewer] };

	const adapter: GithubAdapter = {
		...makeAdapter(),
		platform_methods: {
			...makeAdapter().platform_methods,
			getPrReviews: async () => [
				{ author: reviewer, time: new Date("2024-01-01T10:00:00Z"), state: "approved" as ReviewerState },
				{ author: reviewer, time: new Date("2024-01-01T11:00:00Z"), state: "commented" as ReviewerState },
			],
		},
	};

	const result = await constructSlackMessage(
		adapter, pullyOptions, pullyDataWithReviewer, prAuthor,
		"My PR", 7, "open", "owner", "repo",
		"https://github.com/owner/repo/pull/7",
	);

	assertEquals(result, ":github-pr: <https://github.com/owner/repo/pull/7|[owner/repo]> My PR (#7)  by Alice | :github-approve: Bob ");
});

Deno.test("review status is on a second line when PULLY_REVIEW_STATUS_ON_NEW_LINE is set", async () => {
	const prAuthor: AuthorInfo = { githubUsername: "alice", firstName: "Alice" };
	const reviewer: AuthorInfo = { githubUsername: "bob", firstName: "Bob" };
	const pullyDataWithReviewer: PullyData = { known_authors: [reviewer] };

	const adapter: GithubAdapter = {
		...makeAdapter(),
		platform_methods: {
			...makeAdapter().platform_methods,
			getPrReviews: async () => [
				{ author: reviewer, time: new Date(), state: "approved" as ReviewerState },
			],
		},
	};

	const result = await constructSlackMessage(
		adapter,
		{ ...pullyOptions, PULLY_REVIEW_STATUS_ON_NEW_LINE: true },
		pullyDataWithReviewer,
		prAuthor,
		"My PR",
		8,
		"open",
		"owner",
		"repo",
		"https://github.com/owner/repo/pull/8",
	);

	assertEquals(result, ":github-pr: <https://github.com/owner/repo/pull/8|[owner/repo]> My PR (#8)  by Alice\n:github-approve: Bob ");
});
