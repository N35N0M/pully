// TODO: Need cleanup support after a PR is merged to avoid having lots of dead files in state
// TODO: We need history from time to time
// TODO: Opt-in daily summary in the morning of workdays

import type {
	PullRequestClosedEvent,
	PullRequestConvertedToDraftEvent,
	PullRequestEditedEvent,
	PullRequestEvent,
	PullRequestOpenedEvent,
	PullRequestReadyForReviewEvent,
	PullRequestReopenedEvent,
	PullRequestReviewRequestedEvent,
	PullRequestReviewSubmittedEvent,
} from "@octokit/webhooks-types";
import { WebClient } from "@slack/web-api";
import assert from "node:assert";
import { Octokit } from "octokit";
import * as core from "@actions/core";
import * as github from "@actions/github";

// Typedefs
type PrNumber = number;
export type PrState = "open" | "closed" | "merged" | "queued" | "draft";
type ReviewerState =
	| "approved"
	| "requested-changes"
	| "review_requested"
	| "dismissed";

type GithubUsername = string;
type Reviewers = Record<
	GithubUsername,
	{ timestamp: Date; state: ReviewerState }
>;
type PullyData = {
	known_authors: AuthorInfo[];
};

interface AuthorInfo {
	githubUsername?: string;
	slackMemberId?: string;
	firstName?: string;

	/**
	 * If set, should be one slackmoji to be posted alongside firstname,
	 * i.e. a string staring and ending with colon ":my-slackmoji:"
	 */
	slackmoji?: string;
}

const postToSlack = async (
	slackMessageContent: string,
	prNumber: number,
	isDraft: boolean,
	githubAdapter: GithubAdapter,
	pullyOptions: PullyOptions,
) => {
	const postingInitialDraftsRequested =
		core.getInput("POST_INITIAL_DRAFT") !== "";

	// TODO: Determine existing message timestamp by checking state for timestamp file
	const web = new WebClient(pullyOptions.PULLY_SLACK_TOKEN);
	const octokit = new Octokit({ auth: githubAdapter.GITHUB_TOKEN });

	let existingMessageTimestamp: string | undefined;
	const messagePath =
		`messages/${githubAdapter.GITHUB_REPOSITORY_OWNER}_${githubAdapter.GITHUB_REPOSITORY}_${prNumber}.timestamp`;
	try {
		const pullyStateRaw = await octokit.request(
			"GET /repos/{owner}/{repo}/contents/{path}",
			{
				repo: githubAdapter.GITHUB_REPOSITORY,
				owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
				path: messagePath,
				ref: "refs/heads/pully-persistent-state-do-not-use-for-coding",
			},
		);

		const timestampFile: { timestamp: string } = JSON.parse(
			// @ts-expect-error need to assert that this is file somehow
			atob(pullyStateRaw.data.content),
		);
		existingMessageTimestamp = timestampFile.timestamp;
	} catch (e: unknown) {
		console.log("Error when getting existing timestamp...");
		console.log(e); // Assuming file not found
	}

	// Well, initial for Pully anyway.
	const isInitialDraft = isDraft && existingMessageTimestamp === undefined;
	if (isInitialDraft && !postingInitialDraftsRequested) {
		return;
	}

	if (existingMessageTimestamp) {
		web.chat.update({
			text: slackMessageContent,
			channel: pullyOptions.PULLY_SLACK_CHANNEL,
			ts: existingMessageTimestamp,
		});
	} else {
		const value = await web.chat.postMessage({
			text: slackMessageContent,
			channel: pullyOptions.PULLY_SLACK_CHANNEL,
		});
		if (value.ts) {
			await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
				owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
				repo: githubAdapter.GITHUB_REPOSITORY,
				path: messagePath,
				branch:
					"refs/heads/pully-persistent-state-do-not-use-for-coding",
				message: "Pully state update",
				committer: {
					name: "Pully",
					email: "kris@bitheim.no",
				},
				content: btoa(JSON.stringify({ timestamp: value.ts })),
				// sha: sha, We will never update the file since we have one message per pr...
				headers: {
					"X-GitHub-Api-Version": "2022-11-28",
				},
			});
		}
	}
};

const getAuthorInfoFromGithubLogin = (
	authorInfos: AuthorInfo[],
	githubLogin: string,
): AuthorInfo => {
	const search = authorInfos.find(
		(value) => value.githubUsername === githubLogin,
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

export const constructSlackMessage = async (
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
	pullyRepodataCache: PullyData,
	author: AuthorInfo,
	prTitle: string,
	prNumber: PrNumber,
	prState: PrState,
	repoOwner: string,
	repoName: string,
	prUrl: string,
	lineAdds?: number,
	lineRemovals?: number,
) => {

	const authorToUse = author.firstName ?? author.githubUsername;

	let prStatusSlackmoji = "";
	switch (prState) {
		case "closed":
			prStatusSlackmoji = ":github-closed:";
			break;
		case "open":
			prStatusSlackmoji = ":github-pr:";
			break;
		case "merged":
			prStatusSlackmoji = ":github-merged:";
			break;
		case "draft":
			prStatusSlackmoji = ":github-pr-draft:";
			break;
	}

	let linediff = "";
	if (lineAdds !== undefined && lineRemovals !== undefined) {
		linediff = `(+${lineAdds}/-${lineRemovals})`;
	}

	let repoDisplayName = `${repoOwner}/${repoName}`;
	if (pully_options.PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE) {
		repoDisplayName = repoName;
	}

	// TODO: need to figure out how to keep '>' in the text without breaking the slack post link
	let prDescription = `${
		prTitle.replaceAll(">", "")
	} (#${prNumber}) ${linediff} by ${authorToUse}`;

	const generateSlackLink = (url: string, displayText: string) => {
		return `<${url}|${displayText}>`;
	};

	let repoNameFormatted = `[${repoDisplayName}]`;
	let authorSlackmoji = ""
	if (author.slackmoji) {
		authorSlackmoji = ` ${author.slackmoji}`;
	}

	const prReviews = await github_adapter.platform_methods.getPrReviews(pullyRepodataCache, prNumber)

	const reviewRequests = await github_adapter.platform_methods.getReviewsRequestedForPr(pullyRepodataCache, prNumber);

	const reviews: Reviewers = {};

	// According to the docs, requested_reviewers clear when they submit a review.
	// The API has no timestamp info for the review request, so we got to trust that
	// and just set a dummy timestamp that is guaranteed to be lower than current time.
	for (const request of reviewRequests.reverse()) {
		reviews[request.githubUsername ?? request.firstName ?? ''] = {
			state: "review_requested",
			timestamp: new Date(0),
		};
	}

	// If the reviewer doesnt have an active review request, they might have a review going
	for (const review of prReviews) {
		if (review.author?.githubUsername !== undefined) {
			// Only use the latest review per user
			const timestamp = review.time
			if (
				!(review.author.githubUsername in reviews) ||
				(review.author.githubUsername in reviews &&
					reviews[review.author.githubUsername].state !== "review_requested" &&
					(reviews[review.author.githubUsername].timestamp < timestamp))
			) {
				reviews[review.author.githubUsername] = {
					state: review.state,
					timestamp: timestamp,
				};

			}
		}
	}

	const approvers = new Set();
	const change_requesters = new Set();
	const review_requests = new Set();

	for (const [reviewer, state] of Object.entries(reviews)) {
		const reviewerData = getAuthorInfoFromGithubLogin(
			pullyRepodataCache.known_authors,
			reviewer,
		);
		switch (state.state) {
			case "approved":
				approvers.add(
					`${reviewerData.firstName ?? reviewerData.githubUsername}${
						reviewerData.slackmoji
							? ` ${reviewerData.slackmoji}`
							: ""
					}`,
				);
				break;
			case "requested-changes":
				change_requesters.add(
					`${reviewerData.firstName ?? reviewerData.githubUsername}${
						reviewerData.slackmoji
							? ` ${reviewerData.slackmoji}`
							: ""
					}`,
				);
				break;
			case "review_requested":
				// Only give @ mentions when a review is requested to avoid notification spam
				review_requests.add(`<@${reviewerData.slackMemberId}>`);
		}
	}

	let reviewStatusText = "";
	if (approvers.size !== 0) {
		reviewStatusText += " | :github-approve: " +
			Array.from(approvers).join(", ");
	}

	if (prState === "open") {
		if (change_requesters.size !== 0) {
			reviewStatusText += " | :github-changes-requested: " +
				Array.from(change_requesters).join(", ");
		}

		if (review_requests.size !== 0) {
			reviewStatusText += " | :code-review: " +
				Array.from(review_requests).join(", ");
		}
	}

	// repoDisplayName.length + prDescription.length isnt all the text content here
	// but it is what varies, so it should be good enough
	let leftHandSideTextLength = repoDisplayName.length + prDescription.length;
	if (author.slackmoji) {
		leftHandSideTextLength += 2; // One space and one rendered slackmoji
	}
	if (leftHandSideTextLength > pully_options.max_length_left_hand_side) {
		// -2 for adjusting to ...s
		// And -2 for ??

		// Note that if we truncate the string, author slackmoji never fits (since it is last)
		// So we must compensate and truncate the whole thing
		const desiredLength = pully_options.max_length_left_hand_side - repoNameFormatted.length -2 -2   ;

		assert(desiredLength >= 0); // Just in case

		prDescription = prDescription.slice(
			0,
			desiredLength
		);
		prDescription += "...";
	} else if (
		leftHandSideTextLength < pully_options.max_length_left_hand_side
	) {
		prDescription +=  authorSlackmoji
		prDescription = prDescription.padEnd(pully_options.max_length_left_hand_side + authorSlackmoji.length - 3 - repoNameFormatted.length, " ");
	}

	// Now we can construct the entire string...
	let leftHandSideText = `${generateSlackLink(prUrl, repoNameFormatted)} ${prDescription}`

	// Strikethrough
	if (prState === "closed" || prState === "merged") {
		leftHandSideText = `~${leftHandSideText}~`;
	}

	const slackMessage =
		`${prStatusSlackmoji} ${leftHandSideText}${reviewStatusText}`;

	return slackMessage;
};

const handlePullRequestReviewSubmitted = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestReviewSubmittedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	console.log("Received a pull request review submitted event");

	const prAuthor = getAuthorInfoFromGithubLogin(
		pullyRepodataCache.known_authors,
		payload.pull_request.user?.login ?? "undefined",
	);

	const prData = payload.pull_request;
	let prStatus: PrState = prData.state;
	// Handle special states
	if (!prData.merged_at && prData.state == "closed") {
		prStatus = "closed";
	} else if (!!prData.merged_at) {
		prStatus = "merged";
	} else if (prData.draft) {
		prStatus = "draft";
	}

	const slackMessage = await constructSlackMessage(
		github_adapter,
		pully_options,
		pullyRepodataCache,
		prAuthor,
		prData.title,
		prData.number,
		prStatus,
		payload.repository.owner.login,
		payload.repository.name,
		prData.html_url,
		undefined,
		undefined,
	);

	await postToSlack(
		slackMessage,
		prData.number,
		prStatus === "draft",
		github_adapter,
		pully_options,
	);
};

const handlePullRequestReviewRequested = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestReviewRequestedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	handlePullRequestGeneric(
		pullyRepodataCache,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestGeneric = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	const prData = payload.pull_request;

	const author = getAuthorInfoFromGithubLogin(
		pullyRepodataCache.known_authors,
		prData.user.login,
	);

	let prStatus: PrState = prData.state;

	// Handle special states
	if (!prData.merged && prStatus == "closed") {
		prStatus = "closed";
	} else if (!!prData.merged) {
		prStatus = "merged";
	} else if (prData.draft) {
		prStatus = "draft";
	}

	const slackMessage = await constructSlackMessage(
		github_adapter,
		pully_options,
		pullyRepodataCache,
		author,
		prData.title,
		prData.number,
		prStatus,
		payload.repository.owner.login,
		payload.repository.name,
		prData.html_url,
		prData.additions,
		prData.deletions,
	);
	await postToSlack(
		slackMessage,
		prData.number,
		prStatus === "draft",
		github_adapter,
		pully_options,
	);
};

const handlePullRequestOpened = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestOpenedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	console.log(
		`Received a pull request open event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyRepodataCache,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestReopened = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestReopenedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	console.log(
		`Received a pull request reopened event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyRepodataCache,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestEdited = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestEditedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	console.log(
		`Received a pull request edited event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyRepodataCache,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestConvertedToDraft = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestConvertedToDraftEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	console.log(
		`Received a pull request converted to draft event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyRepodataCache,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestReadyForReview = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestReadyForReviewEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	console.log(
		`Received a pull request ready for review event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyRepodataCache,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestClosed = async (
	pullyRepodataCache: PullyData,
	payload: PullRequestClosedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	console.log(
		`Received a pull request closed event for ${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyRepodataCache,
		payload,
		github_adapter,
		pully_options,
	);
};

const loadPullyState = async (
	github_adapter: GithubAdapter,
): Promise<PullyData> => {
	// TODO: We should create the orphan branch if it doesnt exist already
	let repoData: PullyData;
	const octokit = new Octokit({ auth: github_adapter.GITHUB_TOKEN });
	try {
		// TODO: Should sanitize json data with a schema
		const pullyStateRaw = await octokit.request(
			"GET /repos/{owner}/{repo}/contents/{path}",
			{
				repo: github_adapter.GITHUB_REPOSITORY,
				owner: github_adapter.GITHUB_REPOSITORY_OWNER,
				path: "pullystate.json",
				ref: "refs/heads/pully-persistent-state-do-not-use-for-coding",
			},
		);
		// @ts-expect-error need to assert that this is file somehow
		repoData = JSON.parse(atob(pullyStateRaw.data.content));
		return repoData;
	} catch (e) {
		throw e;
	}
};

export interface GithubAdapter {
	GITHUB_TOKEN: string;
	GITHUB_REPOSITORY: string;
	GITHUB_REPOSITORY_OWNER: string;
	platform_methods: PlatformMethods
}

export interface PullyOptions {
	max_length_left_hand_side: number;
	PULLY_SLACK_TOKEN: string;
	PULLY_SLACK_CHANNEL: string;
	PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE: boolean
}

export interface PlatformMethods {
	/**
	 * Ask the Git platform:
	 * List all reviews already submitted for the PR number
	 */
	getPrReviews: (pullyRepoCache: PullyData, prNumber: number) => Promise<{
		author: AuthorInfo,
		time: Date,
		state: ReviewerState
	}[]>

	/**
	 * Ask the Git platform:
	 * Which users has the author requested a review from (if any), and not gotten a review from yet?
	 * 
	 * Meaning: if the author requested a review from a user, and a user SINCE has provided a review,
	 * they shall not be listed here
	 */
	getReviewsRequestedForPr: (pullyRepoCache: PullyData, prNumber: number) => Promise<AuthorInfo[]>
}

const savePullyState = async (
	pullyState: PullyData,
	github_adapter: GithubAdapter,
) => {
	const octokit = new Octokit({ auth: github_adapter.GITHUB_TOKEN });
	const pullyStateRaw = await octokit.request(
		"GET /repos/{owner}/{repo}/contents/{path}",
		{
			repo: github_adapter.GITHUB_REPOSITORY,
			owner: github_adapter.GITHUB_REPOSITORY_OWNER,
			path: "pullystate.json",
			ref: "refs/heads/pully-persistent-state-do-not-use-for-coding",
		},
	);

	// @ts-expect-error need to assert that this is file somehow
	const sha = pullyStateRaw.data.sha;

	await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
		owner: github_adapter.GITHUB_REPOSITORY_OWNER,
		repo: github_adapter.GITHUB_REPOSITORY,
		path: "pullystate.json",
		branch: "refs/heads/pully-persistent-state-do-not-use-for-coding",
		message: "Pully state update",
		committer: {
			name: "Pully",
			email: "kris@bitheim.no",
		},
		content: btoa(JSON.stringify(pullyState)),
		sha: sha,
		headers: {
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});
	console.log("Saved state");
};

const main = () => {
	const eventName = github.context.eventName;
	core.info(`The eventName: ${eventName}`);
	console.log(github.context);

	// Environment variables
	// TODO: Make sure not to require github if we are actually making this vendor-agnostic at some point..
	const GITHUB_REPOSITORY_OWNER = github.context.payload.repository?.owner
		.login;
	const GITHUB_REPOSITORY = github.context.payload.repository?.name;
	const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
	const PR_DESCRIPTION_CONTENT_LENGTH = Number(
		core.getInput("PR_DESCRIPTION_CONTENT_LENGTH") ?? "100",
	);
	assert(
		!!GITHUB_TOKEN,
		"GITHUB_TOKEN was undefined in the environment! This must be set to a token with read and write access to the repo's pully-persistent-state-do-not-use-for-coding branch",
	);
	assert(
		!!GITHUB_REPOSITORY_OWNER,
		"GITHUB_REPOSITORY_OWNER, i.e. the owner of the repo this is running for, was unexpectedly undefined in the runtime environment!",
	);
	assert(
		!!GITHUB_REPOSITORY,
		"GITHUB_REPOSITORY, i.e. <owner/reponame> from github, was unexpectedly undefined in the runtime environment.",
	);

	const PULLY_SLACK_TOKEN = core.getInput("PULLY_SLACK_TOKEN");
	const PULLY_SLACK_CHANNEL = core.getInput("PULLY_SLACK_CHANNEL");
	assert(
		!!PULLY_SLACK_TOKEN,
		"PULLY_SLACK_TOKEN was not defined in the environment",
	);
	assert(
		!!PULLY_SLACK_CHANNEL,
		"PULLY_SLACK_CHANNEL (the slack channel id) was not defined in the environment",
	);

	const pullyOptions: PullyOptions = {
		max_length_left_hand_side: PR_DESCRIPTION_CONTENT_LENGTH,
		PULLY_SLACK_CHANNEL: PULLY_SLACK_CHANNEL,
		PULLY_SLACK_TOKEN: PULLY_SLACK_TOKEN,
		PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE: core.getInput("PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE") !== ""
	}

	const githubAdapter: GithubAdapter = {
		GITHUB_TOKEN: GITHUB_TOKEN,
		GITHUB_REPOSITORY: GITHUB_REPOSITORY,
		GITHUB_REPOSITORY_OWNER: GITHUB_REPOSITORY_OWNER,
		platform_methods: {
			getReviewsRequestedForPr: async (pullyData, prNumber) => {
				const octokit = new Octokit({ auth: GITHUB_TOKEN });

	const reviewRequests = await octokit.request(

		"GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
		{
			owner: GITHUB_REPOSITORY_OWNER,
			repo: GITHUB_REPOSITORY,
			pull_number: prNumber,
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
			},
		},
	);

			return reviewRequests.data.users.map((value) => {
				return getAuthorInfoFromGithubLogin(pullyData.known_authors, value.login)
			})
			},
			getPrReviews: async (pullyData, prNumber) => {
				const octokit = new Octokit({ auth: GITHUB_TOKEN });
				const prReviews = await octokit.request(
					"GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
					{
						owner: GITHUB_REPOSITORY_OWNER,
						repo: GITHUB_REPOSITORY,
						pull_number: prNumber,
						headers: {
							"X-GitHub-Api-Version": "2022-11-28",
						},
					},
				);

				return prReviews.data.map((value) => {
					let reviewType: ReviewerState = "dismissed";

					if (value.state === "APPROVED"){
						reviewType = "approved"
					}
					else if (value.state === "REQUESTED_CHANGES"){
						reviewType = "requested-changes"
					}

					if (value.submitted_at === undefined){
						throw Error("Review submitted at was unexpectedly undefined!")
					}
					
					return {author: getAuthorInfoFromGithubLogin(pullyData.known_authors, value.user!.login), time: new Date(value.submitted_at), state: reviewType}
				})
			},
		}
	}

	loadPullyState(githubAdapter).then((repoData) => {
		const getEventData = ():
			| PullRequestReviewSubmittedEvent
			| PullRequestOpenedEvent
			| PullRequestReviewRequestedEvent
			| PullRequestClosedEvent
			| PullRequestReopenedEvent
			| PullRequestEditedEvent
			| PullRequestConvertedToDraftEvent
			| PullRequestReadyForReviewEvent => {
			let eventData:
				| PullRequestReviewSubmittedEvent
				| PullRequestOpenedEvent
				| PullRequestReviewRequestedEvent
				| PullRequestClosedEvent
				| PullRequestReopenedEvent
				| PullRequestEditedEvent
				| PullRequestConvertedToDraftEvent
				| PullRequestReadyForReviewEvent;

			// @ts-ignore TODO can we type narrow this to the correct type...?
			eventData = github.context.payload;

			return eventData;
		};

		const data = getEventData();

		// Then handle provided event payload (TODO to make this not strictly github based...)
		switch (data.action) {
			case "submitted":
				handlePullRequestReviewSubmitted(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			case "closed":
				handlePullRequestClosed(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			case "opened":
				handlePullRequestOpened(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			case "reopened":
				handlePullRequestReopened(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			case "review_requested":
				handlePullRequestReviewRequested(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			case "converted_to_draft":
				handlePullRequestConvertedToDraft(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			case "ready_for_review":
				handlePullRequestReadyForReview(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			case "edited":
				handlePullRequestEdited(repoData, data, githubAdapter, pullyOptions).then(() =>
					savePullyState(repoData, githubAdapter)
				);
				break;
			default:
				console.log(`Got unknown event to handle: ${data}`);
		}
	});
};
