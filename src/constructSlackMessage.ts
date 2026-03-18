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
	let prDescription = `${prTitle.replaceAll(">", "")} (#${prNumber}) ${linediff} by ${authorToUse}${author.slackmoji ? ` ${author.slackmoji}` : ''}`;

	const generateSlackLink = (url: string, displayText: string) => {
		return `<${url}|${displayText}>`;
	};

	let repoNameFormatted = `[${repoDisplayName}]`;

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

	const reviewStatePriority = (state: string): number => {
		if (state === "approved" || state === "requested-changes") return 2;
		if (state === "commented") return 1;
		return 0;
	};

	// If the reviewer doesnt have an active review request, they might have a review going
	for (const review of prReviews) {
		if (review.author?.githubUsername !== undefined) {
			const timestamp = review.time;
			const existing = reviews[review.author.githubUsername];
			if (!existing ||
				(reviewStatePriority(review.state) >= reviewStatePriority(existing.state) &&
					existing.timestamp < timestamp)) {
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
	const commenters = new Set();

	for (const [reviewer, state] of Object.entries(reviews)) {
		const reviewerData = getAuthorInfoFromGithubLogin(
			pullyRepodataCache.known_authors,
			reviewer
		);
		switch (state.state) {
			case "approved":
				approvers.add(
					`${reviewerData.firstName ?? reviewerData.githubUsername} ${reviewerData.slackmoji
						? `${reviewerData.slackmoji}`
						: ""}`
				);
				break;
			case "requested-changes":
				change_requesters.add(
					`${reviewerData.firstName ?? reviewerData.githubUsername} ${reviewerData.slackmoji
						? `${reviewerData.slackmoji}`
						: ""}`
				);
				break;
			case "commented":
				commenters.add(
					`${reviewerData.firstName ?? reviewerData.githubUsername} ${reviewerData.slackmoji
						? `${reviewerData.slackmoji}`
						: ""}`
				);
				break;
			case "review_requested":
				// Only give @ mentions when a review is requested to avoid notification spam
				review_requests.add(reviewerData.slackMemberId ? `<@${reviewerData.slackMemberId}>` : `${reviewerData.githubUsername}`);
		}
	}

	const prIsClosed = prState === "closed" || prState === "merged";
	const hideReviews = prIsClosed && pully_options.PULLY_HIDE_REVIEWS_WHEN_PR_CLOSED;

	let reviewStatusText = "";
	if (!hideReviews && approvers.size !== 0) {
		reviewStatusText += " | :github-approve: " +
			Array.from(approvers).join(", ");
	}

	if (!hideReviews && prState === "open") {
		if (change_requesters.size !== 0) {
			reviewStatusText += " | :github-changes-requested: " +
				Array.from(change_requesters).join(", ");
		}

		if (commenters.size !== 0) {
			reviewStatusText += " | :speech_balloon: " +
				Array.from(commenters).join(", ");
		}

		if (review_requests.size !== 0) {
			reviewStatusText += " | :code-review: " +
				Array.from(review_requests).join(", ");
		}
	}

	// repoDisplayName.length + prDescription.length isnt all the text content here
	// but it is what varies, so it should be good enough

	// Now we can construct the entire string...
	let leftHandSideText = `${generateSlackLink(prUrl, repoNameFormatted)} ${prDescription}`;

	// Strikethrough
	if (prState === "closed" || prState === "merged") {
		leftHandSideText = `~${leftHandSideText}~`;
	}

	const slackMessage = reviewStatusText && pully_options.PULLY_REVIEW_STATUS_ON_NEW_LINE
		? `${prStatusSlackmoji} ${leftHandSideText}\n${reviewStatusText.slice(" | ".length)}`
		: `${prStatusSlackmoji} ${leftHandSideText}${reviewStatusText}`;

	return slackMessage;
};
