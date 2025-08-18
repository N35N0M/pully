import fs, { readFileSync } from "fs";
import {
	PullRequestClosedEvent,
	PullRequestEvent,
	PullRequestOpenedEvent,
	PullRequestReviewRequestedEvent,
	PullRequestReviewSubmittedEvent,
} from "@octokit/webhooks-types";
import { WebClient } from "@slack/web-api";

type PrNumber = number;
type SlackMessageTimestamp = string;
type PrState = "open" | "closed" | "merged";
type ReviewerState =
	| "approved"
	| "requested-changes"
	| "review_requested"
	| "dismissed";

type GithubUsername = string;
type Reviewers = Record<GithubUsername, ReviewerState>;
type PrData = Record<PrNumber, IPrData>;
type RepoFullname = string; 
type RepoData = Record<RepoFullname, IRepoData>;

interface AuthorInfo {
	githubUsername?: string;
	slackMemberId?: string;
	firstName?: string;
}

interface IPrData {
	reviews: Reviewers;
	/**
	 * This repo explicitly assumes one slack message (and thus channel) per pull request
	 */
	message?: SlackMessageTimestamp;
}

interface IRepoData {
	prData: PrData;
}

const postToSlack = async (
	slackMessageContent: string,
	pullyPrDataCache: IPrData,
) => {
	const token = process.env.SLACK_TOKEN as string;
	const channel = process.env.SLACK_CHANNEL as string;
	const web = new WebClient(token);

	if (pullyPrDataCache.message) {
		web.chat.update({
			text: slackMessageContent,
			channel: channel,
			ts: pullyPrDataCache.message,
		});
	} else {
		const value = await web.chat.postMessage({
			text: slackMessageContent,
			channel: channel,
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

const ensureStateIsInitializedForRepoAndPr = (
	pullyRepodataCache: RepoData,
	repoFullName: string,
	prNumber: number,
) => {
	if (!(repoFullName in pullyRepodataCache)) {
		pullyRepodataCache[repoFullName] = { prData: {[prNumber]: { reviews: {}, message: undefined }} };
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

	await postToSlack(slackMessage, specificPrData);
};

const handlePullRequestReviewRequested = async (
	pullyRepodataCache: RepoData,
	payload: PullRequestReviewRequestedEvent,
) => {
	const prDataCache = getPrDataCache(
		pullyRepodataCache,
		payload.repository.full_name,
		payload.pull_request.number,
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

	handlePullRequestGeneric(pullyRepodataCache, payload);
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
	await postToSlack(slackMessage, prDataCache);
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

const repodatafile = "repodata.json";

const loadPullyState = (): RepoData => {
	let repoData: RepoData = {};

	// TODO: fetch state file from orphan branch

	try {
		// TODO: Should sanitize json data
		repoData = JSON.parse(readFileSync(repodatafile, "utf-8"));
	} catch {
		console.warn("No data.json found, starting state from scratch...");
	}

	return repoData;
}

const savePullyState = (pullyState: RepoData) => {
	fs.writeFileSync(repodatafile, JSON.stringify(pullyState));
	// TODO: Need to write to orphan branch and push to remote
	console.log("Saved state");
};



const repoData = loadPullyState();

// TODO: Invoke correct handler based on type

savePullyState(repoData);