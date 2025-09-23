import { GithubUsername, ReviewerState } from "./index.ts";

export type Reviewers = Record<
	GithubUsername, { timestamp: Date; state: ReviewerState; }
>;
