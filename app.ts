import fs, { readFileSync } from "fs";
import {
	PullRequestClosedEvent,
	PullRequestEvent,
	PullRequestOpenedEvent,
	PullRequestReviewRequestedEvent,
	PullRequestReviewSubmittedEvent,
} from "@octokit/webhooks-types";
import { WebClient } from "@slack/web-api";

// This assigns the values of your environment variables to local variables.
const token = process.env.SLACK_TOKEN as string;
const testChannel = process.env.SLACK_CHANNEL as string;

type PrNumber = number;
type SlackMessageTimestamp = string;

interface AuthorInfo {
	/**
	 * The github username (i.e. "login" field in the User API)
	 */
	githubUsername?: string;
	slackMemberId?: string;
	firstName?: string;
}

const postToSlack = async (
	slackChannelId: string,
	slackMessageContent: string,
	pullyPrDataCache: IPrData,
) => {
	const web = new WebClient(token);

	if (pullyPrDataCache.message) {
		web.chat.update({
			text: slackMessageContent,
			channel: slackChannelId,
			ts: pullyPrDataCache.message,
		});
	} else {
		const value = await web.chat.postMessage({
			text: slackMessageContent,
			channel: slackChannelId,
		});
		if (value.ts) {
			pullyPrDataCache.message = value.ts;
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
	};
};

// TODO: Fix function that loads this info from env and populates authorinfos so we dont have to keep this in the src
const authors: AuthorInfo[] = [
	{ githubUsername: "N35N0M", slackMemberId: "U08FWFQPT60", firstName: "Kris" },
	{
		githubUsername: "kristoffer-monsen-bulder",
		slackMemberId: "U08FWFQPT60",
		firstName: "Kris",
	},
];

type PrState = "open" | "closed" | "merged";
type ReviewerState =
	| "approved"
	| "requested-changes"
	| "review_requested"
	| "dismissed";

type GithubUsername = string;
type Reviewers = Record<GithubUsername, ReviewerState>;

interface IPrData {
	reviews: Reviewers;
	/**
	 * This repo explicitly assumes one slack message (and thus channel) per pull request
	 */
	message?: SlackMessageTimestamp;
}

type PrData = Record<PrNumber, IPrData>;

/**
 * The full name of the repo, i.e. <owner/repo name>, where owner is either a github user or a github organization
 */
type RepoFullname = string;

/**
 * The reason why we keep a local state instead of just scraping repos for data all the time is that it
 * requires more access privileges (instead of just being able to see pr-related webhook payloads)
 */
const repodatafile = "repodata.json";

interface IRepoData {
	prData: PrData;
}

// TODO lets not do god states to make function signatures easier
type RepoData = Record<RepoFullname, IRepoData>;
let repoData: RepoData = {};

try {
	// TODO: Should sanitize json data
	repoData = JSON.parse(readFileSync(repodatafile, "utf-8"));
} catch {
	console.warn("No data.json found, starting state from scratch...");
}

const saveMessageCacheAndReviewStates = (repoDataToSave: RepoData) => {
	fs.writeFileSync(repodatafile, JSON.stringify(repoDataToSave));
	// TODO need logic to save/load to orphan branch...
	console.log("Saved state");
};

/**
 * Constructs a one-line slack message, meant to be invoked whenever any of the arguments change
 */
const constructDenseSlackMessage = (
	pullyRepodataCache: RepoData,
	author: AuthorInfo,
	prTitle: string,
	prNumber: PrNumber,
	prState: PrState,
	repoFullname: RepoFullname,
	prUrl: string,
	lineAdds?: number,
	lineRemovals?: number,
) => {
	let authorToUse = author.firstName ?? author.githubUsername;

	let statusSlackmoji = "";
	switch (prState) {
		case "closed":
			statusSlackmoji = ":github-closed:";
			break;
		case "open":
			statusSlackmoji = ":github-pr:";
			break;
		case "merged":
			statusSlackmoji = ":github-merged:";
	}

	let linediff = "";
	if (lineAdds !== undefined && lineRemovals !== undefined) {
		linediff = `(+${lineAdds}/-${lineRemovals})`;
	}

	let text = `<${prUrl}|[${repoFullname}] ${prTitle} (#${prNumber})> ${linediff} by ${authorToUse}`;

	if (repoFullname in pullyRepodataCache) {
		const specificRepoData = pullyRepodataCache[repoFullname];

		if (prNumber in specificRepoData.prData) {
			const prReviewData = specificRepoData.prData[prNumber];

			const approvers = new Set();
			const change_requesters = new Set();
			const review_requests = new Set();

			for (let [reviewer, state] of Object.entries(prReviewData)) {
				const reviewerData = getAuthorInfoFromGithubLogin(authors, reviewer);
				switch (state) {
					case "approved":
						approvers.add(
							reviewerData.firstName ?? reviewerData.githubUsername,
						);
						break;
					case "requested-changes":
						approvers.add(
							reviewerData.firstName ?? reviewerData.githubUsername,
						);
						break;
					case "review_requested":
						// Only give @ mentions when a review is requested to avoid notification spam
						review_requests.add(`<@${reviewerData.slackMemberId}>`);
				}
			}

			if (approvers.size !== 0) {
				text += " | :github-approve: " + Array.from(approvers).join(", ");
			}

			if (prState === "open") {
				if (change_requesters.size !== 0) {
					text +=
						" | :github-changes-requested: " +
						Array.from(change_requesters).join(", ");
				}

				if (review_requests.size !== 0) {
					text += " | :code-review: " + Array.from(review_requests).join(", ");
				}
			}
		}
	}

	if (prState === "closed" || prState === "merged") {
		text = `~${text}~`;
	}

	text = `${statusSlackmoji} ${text}`;

	return text;
};

/**
 * @param repoFullName
 * @param prNumber
 */
const ensureStateIsInitializedForRepoAndPr = (
	pullyRepodataCache: RepoData,
	repoFullName: string,
	prNumber: number,
) => {
	if (!(repoFullName in pullyRepodataCache)) {
		pullyRepodataCache[repoFullName] = { prData: {} };
	}

	const specificRepoData = pullyRepodataCache[repoFullName].prData;

	if (!(prNumber in specificRepoData)) {
		specificRepoData[prNumber] = { reviews: {}, message: undefined };
	}
};

const getPrDataCache = (
	pullyRepodataCache: RepoData,
	repoFullName: RepoFullname,
	prNumber: PrNumber,
): IPrData => {
	ensureStateIsInitializedForRepoAndPr(
		pullyRepodataCache,
		repoFullName,
		prNumber,
	);
	return pullyRepodataCache[repoFullName].prData[prNumber];
};

const handlePullRequestReviewSubmitted = async (
	pullyRepodataCache: RepoData,
	payload: PullRequestReviewSubmittedEvent,
) => {
	console.log("Received a pull request review submitted event");

	const specificPrData = getPrDataCache(
		pullyRepodataCache,
		payload.repository.full_name,
		payload.pull_request.number,
	);

	const author = getAuthorInfoFromGithubLogin(
		authors,
		payload.review.user?.login ?? "undefined",
	);

	// Store only a public identifier in the persistent state
	if (author.githubUsername) {
		switch (payload.review.state) {
			case "approved":
				specificPrData.reviews[author.githubUsername] = "approved";
				break;
			case "changes_requested":
				specificPrData.reviews[author.githubUsername] = "requested-changes";
				break;
			case "dismissed":
				specificPrData.reviews[author.githubUsername] = "dismissed";
		}
	}

	const prData = payload.pull_request;
	const slackMessage = constructDenseSlackMessage(
		pullyRepodataCache,
		author,
		prData.title,
		prData.number,
		prData.state,
		payload.repository.full_name,
		prData.html_url,
		undefined,
		undefined,
	);

	await postToSlack(testChannel, slackMessage, specificPrData);
	saveMessageCacheAndReviewStates(repoData);
};

const handlePullRequestReviewRequested = async (
	pullyRepodataCache: RepoData,
	payload: PullRequestReviewRequestedEvent,
) => {
	const repoFullName = payload.repository.full_name;
	const prNumber = payload.pull_request.number;
	const prDataCache = getPrDataCache(
		pullyRepodataCache,
		repoFullName,
		prNumber,
	);

	let author: AuthorInfo = { slackMemberId: "", githubUsername: "" };
	if ("requested_reviewer" in payload) {
		author = getAuthorInfoFromGithubLogin(
			authors,
			payload.requested_reviewer.login,
		);

		if (author.githubUsername) {
			prDataCache.reviews[author.githubUsername] = "review_requested";
		}
	} else if ("requested_team" in payload) {
		console.log("TODO we dont handle team review requests just yet.");
		return;
	} else {
		console.log("Unexpected review request format");
		return;
	}

	const prData = payload.pull_request;
	const slackMessage = constructDenseSlackMessage(
		pullyRepodataCache,
		author,
		prData.title,
		prNumber,
		prData.state,
		repoFullName,
		prData.html_url,
		prData.additions,
		prData.deletions,
	);

	await postToSlack(testChannel, slackMessage, prDataCache);
	saveMessageCacheAndReviewStates(repoData);
};

const handlePullRequestGeneric = async (
	pullyRepodataCache: RepoData,
	payload: PullRequestEvent,
) => {
	const repoFullName = payload.repository.full_name;
	const prNumber = payload.pull_request.number;
	const prDataCache = getPrDataCache(
		pullyRepodataCache,
		repoFullName,
		prNumber,
	);
	const prData = payload.pull_request;

	const author = getAuthorInfoFromGithubLogin(authors, prData.user.login);

	const slackMessage = constructDenseSlackMessage(
		pullyRepodataCache,
		author,
		prData.title,
		prData.number,
		prData.state,
		payload.repository.full_name,
		prData.html_url,
		prData.additions,
		prData.deletions,
	);
	await postToSlack(testChannel, slackMessage, prDataCache);
	saveMessageCacheAndReviewStates(repoData);
};

const handlePullRequestOpened = async (
	pullyRepodataCache: RepoData,
	payload: PullRequestOpenedEvent,
) => {
	console.log(`Received a pull request event for #${payload.pull_request.url}`);
	await handlePullRequestGeneric(pullyRepodataCache, payload);
};

const handlePullRequestClosed = async (
	pullyRepodataCache: RepoData,
	payload: PullRequestClosedEvent,
) => {
	console.log(
		`Received a pull request closed event for ${payload.pull_request.url}`,
	);
	await handlePullRequestGeneric(pullyRepodataCache, payload);
};
