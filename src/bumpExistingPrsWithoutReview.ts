import { GithubAdapter } from "./GithubAdapter.ts";
import { PullyData } from "./PullyData.ts";
import { PullyOptions } from "./PullyOptions.ts";
import { isTitleDraft } from "./isTitleDraft.ts";

export const REMINDER_MESSAGES: Array<(mentions?: string) => string> = [
	(mentions) => mentions ? `:code-review: Waiting for a review from ${mentions}` : `:egg: Bump #1! Please review with a resulting approve or change request <3`,
	(mentions) => mentions ? `:code-review: Friendly reminder - still waiting for a review from ${mentions}` : `:hatching_chick: Bump #2! Pleeeeease review with a resulting approve or change request <3`,
	(mentions) => mentions ? `:code-review: This PR has been waiting a while - a review from ${mentions} would be appreciated` : `:hatched_chick: Pretty pleeeeeeease?`,
	(mentions) => mentions ? `:code-review: This PR is ready to take out of the oven ${mentions}` : `:chicken: Pretty pretty please with sugar on top?`,
	(mentions) => mentions ? `:code-review: This PR has been sizzling and is now ready for ${mentions}!` : `:poultry_leg: Final reminder, is the PR stale and should be closed?`,
];

export const bumpExistingPrsWithoutReview = async (
	pullyUserConfig: PullyData,
	github_adapter: GithubAdapter,
	_pully_options: PullyOptions,
	postReply: (message: string, threadTs: string) => Promise<string | undefined>,
) => {
	const openPrNumbers = await github_adapter.platform_methods.listOpenPrs();

	for (const prNumber of openPrNumbers) {
		const title = await github_adapter.platform_methods.getPrTitle(prNumber);
		if (isTitleDraft(title)) continue;

		const reviews = await github_adapter.platform_methods.getPrReviews(pullyUserConfig, prNumber);
		const hasSignificantReview = reviews.some(
			r => r.state === "approved" || r.state === "requested-changes"
		);
		if (hasSignificantReview) continue;

		const existingTs = await github_adapter.platform_methods.getExistingMessageTimestamp(prNumber);
		if (!existingTs) continue;

		const reminderTimestamps = await github_adapter.platform_methods.getReminderTimestampsForPr(prNumber);
		if (reminderTimestamps.length >= 5) continue;

const reviewRequests = await github_adapter.platform_methods.getReviewsRequestedForPr(pullyUserConfig, prNumber);
		const mentions = reviewRequests.length > 0
			? reviewRequests.map(r => r.slackMemberId ? `<@${r.slackMemberId}>` : r.githubUsername ?? r.firstName ?? "unknown").join(", ")
			: undefined;

		const reminderMessage = REMINDER_MESSAGES[reminderTimestamps.length](mentions);

		const replyTs = await postReply(reminderMessage, existingTs);
		if (replyTs) {
			await github_adapter.platform_methods.addReminderTimestampForPr(prNumber, replyTs);
		}
	}
};
