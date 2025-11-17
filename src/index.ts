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
import { constructSlackMessage } from "./constructSlackMessage.ts";
import { GithubAdapter } from "./GithubAdapter.ts";
import { PullyOptions } from "./PullyOptions.ts";
import { PullyData } from "./PullyData.ts";
import { AuthorInfo } from "./AuthorInfo.ts";
import { PrState } from "./PrState.ts";
import { getAuthorInfoFromGithubLogin } from "./getAuthorInfoFromGithubLogin.ts";

export type ReviewerState =
	| "approved"
	| "requested-changes"
	| "review_requested"
	| "dismissed";

export type GithubUsername = string;
const postToSlack = async (
	slackMessageContent: string,
	prNumber: number,
	isDraft: boolean,
	githubAdapter: GithubAdapter,
	pullyOptions: PullyOptions,
) => {
	const postingInitialDraftsRequested =
		core.getInput("POST_INITIAL_DRAFT") !== "";

	const web = new WebClient(pullyOptions.PULLY_SLACK_TOKEN);

	let existingMessageTimestamp: string | undefined = await githubAdapter.platform_methods.getExistingMessageTimestamp(prNumber)


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
			await githubAdapter.platform_methods.updateSlackMessageTimestampForPr(prNumber, value.ts)
		}
	}
};

const handlePullRequestReviewSubmitted = async (
	pullyUserConfig: PullyData,
	payload: PullRequestReviewSubmittedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	core.info("Received a pull request review submitted event");

	const prAuthor = getAuthorInfoFromGithubLogin(
		pullyUserConfig.known_authors,
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
		pullyUserConfig,
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
	pullyUserConfig: PullyData,
	payload: PullRequestReviewRequestedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	handlePullRequestGeneric(
		pullyUserConfig,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestGeneric = async (
	pullyUserConfig: PullyData,
	payload: PullRequestEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	const prData = payload.pull_request;

	const author = getAuthorInfoFromGithubLogin(
		pullyUserConfig.known_authors,
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
		pullyUserConfig,
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
	pullyUserConfig: PullyData,
	payload: PullRequestOpenedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	core.info(
		`Received a pull request open event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyUserConfig,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestReopened = async (
	pullyUserConfig: PullyData,
	payload: PullRequestReopenedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	core.info(
		`Received a pull request reopened event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyUserConfig,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestEdited = async (
	pullyUserConfig: PullyData,
	payload: PullRequestEditedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	core.info(
		`Received a pull request edited event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyUserConfig,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestConvertedToDraft = async (
	pullyUserConfig: PullyData,
	payload: PullRequestConvertedToDraftEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	core.info(
		`Received a pull request converted to draft event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyUserConfig,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestReadyForReview = async (
	pullyUserConfig: PullyData,
	payload: PullRequestReadyForReviewEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	core.info(
		`Received a pull request ready for review event for #${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyUserConfig,
		payload,
		github_adapter,
		pully_options,
	);
};

const handlePullRequestClosed = async (
	pullyUserConfig: PullyData,
	payload: PullRequestClosedEvent,
	github_adapter: GithubAdapter,
	pully_options: PullyOptions,
) => {
	core.info(
		`Received a pull request closed event for ${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(
		pullyUserConfig,
		payload,
		github_adapter,
		pully_options,
	);
};


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

	/**
	 * Gets the existing slack message timestamp for a given PR. This is slack's mechanism for updating existing messages.
	 * 
	 * If undefined, we havent posted to slack about this PR yet.
	 * If defined, we have posted to slack regarding this PR and this is the message timestamp related to it.
	 */
	getExistingMessageTimestamp: (prNumber: number) => Promise<string | undefined>

	updateSlackMessageTimestampForPr: (prNumber: number, timestamp: string) => Promise<undefined>;

	loadPullyUserConfig: () => Promise<PullyData>;
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
	core.info("Saved state");
};

const main = () => {
	const eventName = github.context.eventName;
	core.info(`The eventName: ${eventName}`);
	core.info(`${github.context}`);

	// Environment variables
	// TODO: Make sure not to require github if we are actually making this vendor-agnostic at some point..
	const GITHUB_REPOSITORY_OWNER = github.context.payload.repository?.owner
		.login;
	const GITHUB_REPOSITORY = github.context.payload.repository?.name;
	const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");

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

					if (value.state === "APPROVED") {
						reviewType = "approved"
					}
					else if (value.state === "CHANGES_REQUESTED") {
						reviewType = "requested-changes"
					}

					if (value.submitted_at === undefined) {
						throw Error("Review submitted at was unexpectedly undefined!")
					}

					return { author: getAuthorInfoFromGithubLogin(pullyData.known_authors, value.user!.login), time: new Date(value.submitted_at ?? 0), state: reviewType }
				})
			},
			getExistingMessageTimestamp: async (prNumber) => {
				let existingMessageTimestamp: string | undefined = undefined;
				const octokit = new Octokit({ auth: GITHUB_TOKEN });
				const pullybranch = '.pullystate';

				const messagePath =
					`messages/${githubAdapter.GITHUB_REPOSITORY_OWNER}_${githubAdapter.GITHUB_REPOSITORY}_${prNumber}.timestamp`;
				try {
					const pullyStateRaw = await octokit.request(
						"GET /repos/{owner}/{repo}/contents/{path}",
						{
							repo: githubAdapter.GITHUB_REPOSITORY,
							owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
							path: messagePath,
							ref: `refs/heads/${pullybranch}`,
						},
					);

					const timestampFile: { timestamp: string } = JSON.parse(
						// @ts-expect-error need to assert that this is file somehow
						atob(pullyStateRaw.data.content),
					);
					existingMessageTimestamp = timestampFile.timestamp;
				} catch (e: unknown) {
					core.info("Error when getting existing timestamp...");
					core.info(`${e}`); // Assuming file not found
				}
				return existingMessageTimestamp
			},
			updateSlackMessageTimestampForPr: async (prNumber, timestamp) => {
				const octokit = new Octokit({ auth: GITHUB_TOKEN });
				const pullybranch = '.pullystate';

				core.info("Check that orphan branch .pullystate exists first...")
				try {
					octokit.request('GET /repos/{owner}/{repo}/commits/{branch}', {
						owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
						repo: githubAdapter.GITHUB_REPOSITORY,	
						branch: pullybranch				
					})
					// Branch surely exists
				}
				catch (e: unknown) {
					core.info(`${e}`)
					core.info("Threw error when listing commits in .pullystate....")
					// @ts-ignore Ew but quickfix
					if (e.status == 404){
						core.info("Determined that .pullystate branch doesnt exist. Will try to create  it now...")

						// Solution from https://github.com/orgs/community/discussions/24699#discussioncomment-3245102
						const SHA1_EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
						const res = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
							owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
							repo: githubAdapter.GITHUB_REPOSITORY,
							message: "orp branch initial commit",
							tree: SHA1_EMPTY_TREE,
							parents: [],
							});
						await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
						owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
						repo: githubAdapter.GITHUB_REPOSITORY,
						// If it doesn't start with 'refs' and have at least two slashes, it will be rejected.
						ref: `refs/heads/${pullybranch}`,
						sha: res.data.sha,
						});
					}
					else {
						core.info("Got error when checking existance of .pullystate but not sure what went wrong...")
						core.info(`${e}`)
					}
				}


				// Todo consolidate message path in the github interface
				const messagePath =
					`messages/${githubAdapter.GITHUB_REPOSITORY_OWNER}_${githubAdapter.GITHUB_REPOSITORY}_${prNumber}.timestamp`;
				octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
					owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
					repo: githubAdapter.GITHUB_REPOSITORY,
					path: messagePath,
					branch: `refs/heads/${pullybranch}`,

					message: "Pully state update",
					committer: {
						name: "Pully",
						email: "kris@bitheim.no",
					},
					content: btoa(JSON.stringify({ timestamp: timestamp })),
					// sha: sha, We will never update the file since we have one message per pr...
					headers: {
						"X-GitHub-Api-Version": "2022-11-28",
					},
				});
			},
			loadPullyUserConfig: async () => {
					let repoData: PullyData;
					const octokit = new Octokit({ auth: GITHUB_TOKEN });
					try {
						// TODO: Should sanitize json data with a schema
						const pullyStateRaw = await octokit.request(
							"GET /repos/{owner}/{repo}/contents/{path}",
							{
								repo: GITHUB_REPOSITORY,
								owner: GITHUB_REPOSITORY_OWNER,
								path: ".pully/userconfig.json",
								// By omitting the ref, the call should default to the default branch.
							},
						);
						// @ts-expect-error need to assert that this is file somehow
						repoData = JSON.parse(atob(pullyStateRaw.data.content));
						return repoData;
					} catch (e) {
						core.info(`${e}`)
						return {
							known_authors: []
						}
					}
			
			}

		},
	}


	githubAdapter.platform_methods.loadPullyUserConfig().then((repoData) => {
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
				core.info(`Got unknown event to handle: ${data}`);
		}
	});
};

main();
