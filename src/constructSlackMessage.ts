import assert from "node:assert";
import { getAuthorInfoFromGithubLogin } from "./getAuthorInfoFromGithubLogin.ts";
import { Reviewers } from "./Reviewers.ts";
import { PrState } from "./PrState.ts";
import { PrNumber } from "./PrNumber.ts";
import { AuthorInfo } from "./AuthorInfo.ts";
import { PullyData } from "./PullyData.ts";
import { PullyOptions } from "./PullyOptions.ts";
import { GithubAdapter } from "./GithubAdapter.ts";


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
	lineRemovals?: number
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
	let prDescription = `${prTitle.replaceAll(">", "")} (#${prNumber}) ${linediff} by ${authorToUse}`;

	const generateSlackLink = (url: string, displayText: string) => {
		return `<${url}|${displayText}>`;
	};

	let repoNameFormatted = `[${repoDisplayName}]`;
	let authorSlackmoji = "";
	if (author.slackmoji) {
		authorSlackmoji = ` ${author.slackmoji}`;
	}

	const prReviews = await github_adapter.platform_methods.getPrReviews(pullyRepodataCache, prNumber);

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
			const timestamp = review.time;
			if (!(review.author.githubUsername in reviews) ||
				(review.author.githubUsername in reviews &&
					reviews[review.author.githubUsername].state !== "review_requested" &&
					(reviews[review.author.githubUsername].timestamp < timestamp))) {
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
			reviewer
		);
		switch (state.state) {
			case "approved":
				approvers.add(
					`${reviewerData.firstName ?? reviewerData.githubUsername}${reviewerData.slackmoji
						? ` ${reviewerData.slackmoji}`
						: ""}`
				);
				break;
			case "requested-changes":
				change_requesters.add(
					`${reviewerData.firstName ?? reviewerData.githubUsername}${reviewerData.slackmoji
						? ` ${reviewerData.slackmoji}`
						: ""}`
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
		const desiredLength = pully_options.max_length_left_hand_side - repoNameFormatted.length - 2 - 2;

		assert(desiredLength >= 0); // Just in case

		prDescription = prDescription.slice(
			0,
			desiredLength
		);
		prDescription += "...";
	} else if (leftHandSideTextLength < pully_options.max_length_left_hand_side) {
		prDescription += authorSlackmoji;
		prDescription = prDescription.padEnd(pully_options.max_length_left_hand_side + authorSlackmoji.length - 3 - repoNameFormatted.length, " ");
	}

	// Now we can construct the entire string...
	let leftHandSideText = `${generateSlackLink(prUrl, repoNameFormatted)} ${prDescription}`;

	// Strikethrough
	if (prState === "closed" || prState === "merged") {
		leftHandSideText = `~${leftHandSideText}~`;
	}

	const slackMessage = `${prStatusSlackmoji} ${leftHandSideText}${reviewStatusText}`;

	return slackMessage;
};
