import { readFileSync } from 'fs';
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
} from '@octokit/webhooks-types';
import { WebClient } from '@slack/web-api';
import assert from 'assert';
import { Octokit } from 'octokit';

// Environment variables
// TODO: Make sure not to require github if we are actually making this vendor-agnostic at some point..
const GITHUB_REPOSITORY_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;

assert(
  !!GITHUB_REPOSITORY_OWNER,
  'GITHUB_REPOSITORY_OWNER, i.e. the owner of the repo this is running for, was unexpectedly undefined in the runtime environment!',
);
assert(
  !!GITHUB_REPOSITORY,
  'GITHUB_REPOSITORY, i.e. <owner/reponame> from github, was unexpectedly undefined in the runtime environment.',
);
assert(
  !!GITHUB_TOKEN,
  "GITHUB_TOKEN was undefined in the environment! This must be set to a token with read and write access to the repo's pully-persistent-state-do-not-use-for-coding branch",
);
assert(
  !!GITHUB_EVENT_PATH,
  'GITHUB_EVENT_PATH was undefined in the environment! This should be provided by Github CI and is the same payload as the pull_request and pull_request_review webhooks: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request',
);

const PULLY_SLACK_TOKEN = process.env.PULLY_SLACK_TOKEN as string;
const PULLY_SLACK_CHANNEL = process.env.PULLY_SLACK_CHANNEL as string;
assert(!!PULLY_SLACK_TOKEN, 'PULLY_SLACK_TOKEN was not defined in the environment');
assert(!!PULLY_SLACK_CHANNEL, 'PULLY_SLACK_CHANNEL (the slack channel id) was not defined in the environment');

const GITHUB_REPOSITORY_WITHOUT_OWNER = GITHUB_REPOSITORY.replace(`${GITHUB_REPOSITORY_OWNER}/`, '');

// Typedefs
type PrNumber = number;
type SlackMessageTimestamp = string;
type PrState = 'open' | 'closed' | 'merged' | 'queued' | 'draft';
type ReviewerState = 'approved' | 'requested-changes' | 'review_requested' | 'dismissed';

type GithubUsername = string;
type Reviewers = Record<GithubUsername, ReviewerState>;
type PrData = Record<PrNumber, IPrData>;
type RepoFullname = string;
type PullyData = {
  known_authors: AuthorInfo[];
};

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

const postToSlack = async (slackMessageContent: string, prNumber: number) => {
  // TODO: Determine existing message timestamp by checking state for timestamp file
  const web = new WebClient(PULLY_SLACK_TOKEN);
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  let existingMessageTimestamp: string | undefined;
  const messagePath = `messages/${GITHUB_REPOSITORY_OWNER}_${GITHUB_REPOSITORY_WITHOUT_OWNER}_${prNumber}.timestamp`;
  try {
    const pullyStateRaw = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
      owner: GITHUB_REPOSITORY_OWNER,
      path: messagePath,
      ref: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
    });

    // @ts-expect-error need to assert that this is file somehow
    const timestampFile: { timestamp: string } = JSON.parse(atob(pullyStateRaw.data.content));
    existingMessageTimestamp = timestampFile.timestamp;
  } catch (e: unknown) {
    console.log('Error when getting existing timestamp...');
    console.log(e); // Assuming file not found
  }

  if (existingMessageTimestamp) {
    web.chat.update({
      text: slackMessageContent,
      channel: PULLY_SLACK_CHANNEL,
      ts: existingMessageTimestamp,
    });
  } else {
    const value = await web.chat.postMessage({
      text: slackMessageContent,
      channel: PULLY_SLACK_CHANNEL,
    });
    if (value.ts) {
      await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: GITHUB_REPOSITORY_OWNER,
        repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
        path: messagePath,
        branch: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
        message: 'Pully state update',
        committer: {
          name: 'Pully',
          email: 'kris@bitheim.no',
        },
        content: btoa(JSON.stringify({timestamp: value.ts})),
        // sha: sha, We will never update the file since we have one message per pr...
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    }
  }
};

const getAuthorInfoFromGithubLogin = (authorInfos: AuthorInfo[], githubLogin: string): AuthorInfo => {
  const search = authorInfos.find((value) => value.githubUsername === githubLogin);

  if (search) {
    return search;
  }

  return {
    githubUsername: githubLogin,
    slackMemberId: undefined,
    firstName: undefined,
  };
};

const constructSlackMessage = async (
  pullyRepodataCache: PullyData,
  author: AuthorInfo,
  prTitle: string,
  prNumber: PrNumber,
  prState: PrState,
  repoFullname: RepoFullname,
  prUrl: string,
  lineAdds?: number,
  lineRemovals?: number,
) => {
  const authorToUse = author.firstName ?? author.githubUsername;

  let statusSlackmoji = '';
  switch (prState) {
    case 'closed':
      statusSlackmoji = ':github-closed:';
      break;
    case 'open':
      statusSlackmoji = ':github-pr:';
      break;
    case 'merged':
      statusSlackmoji = ':github-merged:';
      break;
    case 'draft':
      statusSlackmoji = ':github-pr-draft:';
      break;
  }

  let linediff = '';
  if (lineAdds !== undefined && lineRemovals !== undefined) {
    linediff = `(+${lineAdds}/-${lineRemovals})`;
  }

  // TODO: need to figure out how to keep '>' in the text without breaking the slack post link
  let text = `<${prUrl}|[${repoFullname}] ${prTitle.replaceAll('>', '')} (#${prNumber})> ${linediff} by ${authorToUse}`;

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const prReviews = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner: GITHUB_REPOSITORY_OWNER,
    repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
    pull_number: prNumber,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const reviewRequests = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
    owner: GITHUB_REPOSITORY_OWNER,
    repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
    pull_number: prNumber,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const reviews: Reviewers = {};

  // Review requests shall be cleared once review is submitted...
  for (const request of reviewRequests.data.users.reverse()) {
    // Only use the latest review per user
    if (!(request.login in prReviews)) {
      reviews[request.login] = 'review_requested';
    }
  }

  // Iterate through the reviews backwards as the latest reviews are reported first...
  for (const review of prReviews.data.reverse()) {
    if (review.user?.login !== undefined) {
      // Only use the latest review per user
      if (!(review.user.login in prReviews)) {
        if (review.state === 'APPROVED') {
          reviews[review.user.login] = 'approved';
        } else if (review.state === 'CHANGES_REQUESTED') {
          reviews[review.user.login] = 'requested-changes';
        }
      }
    }
  }

  const approvers = new Set();
  const change_requesters = new Set();
  const review_requests = new Set();

  for (const [reviewer, state] of Object.entries(reviews)) {
    const reviewerData = getAuthorInfoFromGithubLogin(pullyRepodataCache.known_authors, reviewer);
    switch (state) {
      case 'approved':
        approvers.add(reviewerData.firstName ?? reviewerData.githubUsername);
        break;
      case 'requested-changes':
        change_requesters.add(reviewerData.firstName ?? reviewerData.githubUsername);
        break;
      case 'review_requested':
        // Only give @ mentions when a review is requested to avoid notification spam
        review_requests.add(`<@${reviewerData.slackMemberId}>`);
    }
  }

  if (approvers.size !== 0) {
    text += ' | :github-approve: ' + Array.from(approvers).join(', ');
  }

  if (prState === 'open') {
    if (change_requesters.size !== 0) {
      text += ' | :github-changes-requested: ' + Array.from(change_requesters).join(', ');
    }

    if (review_requests.size !== 0) {
      text += ' | :code-review: ' + Array.from(review_requests).join(', ');
    }
  }

  if (prState === 'closed' || prState === 'merged') {
    text = `~${text}~`;
  }

  text = `${statusSlackmoji} ${text}`;

  return text;
};

const handlePullRequestReviewSubmitted = async (
  pullyRepodataCache: PullyData,
  payload: PullRequestReviewSubmittedEvent,
) => {
  console.log('Received a pull request review submitted event');

  const prAuthor = getAuthorInfoFromGithubLogin(
    pullyRepodataCache.known_authors,
    payload.pull_request.user?.login ?? 'undefined',
  );

  const prData = payload.pull_request;
  const slackMessage = await constructSlackMessage(
    pullyRepodataCache,
    prAuthor,
    prData.title,
    prData.number,
    prData.state,
    payload.repository.full_name,
    prData.html_url,
    undefined,
    undefined,
  );

  await postToSlack(slackMessage, prData.number);
};

const handlePullRequestReviewRequested = async (
  pullyRepodataCache: PullyData,
  payload: PullRequestReviewRequestedEvent,
) => {
  handlePullRequestGeneric(pullyRepodataCache, payload);
};

const handlePullRequestGeneric = async (pullyRepodataCache: PullyData, payload: PullRequestEvent) => {
  const prData = payload.pull_request;

  const author = getAuthorInfoFromGithubLogin(pullyRepodataCache.known_authors, prData.user.login);

  let prStatus: PrState = prData.state;

  if (prData.draft) {
    prStatus = 'draft';
  }
  if (prData.merged_at != null) {
    prStatus = 'merged';
  }

  const slackMessage = await constructSlackMessage(
    pullyRepodataCache,
    author,
    prData.title,
    prData.number,
    prStatus,
    payload.repository.full_name,
    prData.html_url,
    prData.additions,
    prData.deletions,
  );
  await postToSlack(slackMessage, prData.number);
};

const handlePullRequestOpened = async (pullyRepodataCache: PullyData, payload: PullRequestOpenedEvent) => {
  console.log(`Received a pull request open event for #${payload.pull_request.url}`);
  await handlePullRequestGeneric(pullyRepodataCache, payload);
};

const handlePullRequestReopened = async (pullyRepodataCache: PullyData, payload: PullRequestReopenedEvent) => {
  console.log(`Received a pull request reopened event for #${payload.pull_request.url}`);
  await handlePullRequestGeneric(pullyRepodataCache, payload);
};

const handlePullRequestEdited = async (pullyRepodataCache: PullyData, payload: PullRequestEditedEvent) => {
  console.log(`Received a pull request edited event for #${payload.pull_request.url}`);
  await handlePullRequestGeneric(pullyRepodataCache, payload);
};

const handlePullRequestConvertedToDraft = async (
  pullyRepodataCache: PullyData,
  payload: PullRequestConvertedToDraftEvent,
) => {
  console.log(`Received a pull request converted to draft event for #${payload.pull_request.url}`);
  await handlePullRequestGeneric(pullyRepodataCache, payload);
};

const handlePullRequestReadyForReview = async (
  pullyRepodataCache: PullyData,
  payload: PullRequestReadyForReviewEvent,
) => {
  console.log(`Received a pull request ready for review event for #${payload.pull_request.url}`);
  await handlePullRequestGeneric(pullyRepodataCache, payload);
};

const handlePullRequestClosed = async (pullyRepodataCache: PullyData, payload: PullRequestClosedEvent) => {
  console.log(`Received a pull request closed event for ${payload.pull_request.url}`);
  await handlePullRequestGeneric(pullyRepodataCache, payload);
};

const loadPullyState = async (): Promise<PullyData> => {
  // TODO: We should create the orphan branch if it doesnt exist already
  let repoData: PullyData;
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  try {
    // TODO: Should sanitize json data with a schema
    const pullyStateRaw = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
      owner: GITHUB_REPOSITORY_OWNER,
      path: 'pullystate.json',
      ref: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
    });
    // @ts-expect-error need to assert that this is file somehow
    repoData = JSON.parse(atob(pullyStateRaw.data.content));
    return repoData;
  } catch (e) {
    throw e;
  }
};

const savePullyState = async (pullyState: PullyData) => {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const pullyStateRaw = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
    owner: GITHUB_REPOSITORY_OWNER,
    path: 'pullystate.json',
    ref: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
  });

  // @ts-expect-error need to assert that this is file somehow
  const sha = pullyStateRaw.data.sha;

  await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner: GITHUB_REPOSITORY_OWNER,
    repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
    path: 'pullystate.json',
    branch: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
    message: 'Pully state update',
    committer: {
      name: 'Pully',
      email: 'kris@bitheim.no',
    },
    content: btoa(JSON.stringify(pullyState)),
    sha: sha,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  console.log('Saved state');
};

// TODO make a main out of this

// LOAD state

loadPullyState().then((repoData) => {
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

    try {
      eventData = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf-8'));
    } catch {
      throw Error('Could not read the github event payload, nothing to do here');
    }

    return eventData;
  };

  const data = getEventData();

  // Then handle provided event payload (TODO to make this not strictly github based...)
  switch (data.action) {
    case 'submitted':
      handlePullRequestReviewSubmitted(repoData, data).then(() => savePullyState(repoData));
      break;
    case 'closed':
      handlePullRequestClosed(repoData, data).then(() => savePullyState(repoData));
      break;
    case 'opened':
      handlePullRequestOpened(repoData, data).then(() => savePullyState(repoData));
      break;
    case 'reopened':
      handlePullRequestReopened(repoData, data).then(() => savePullyState(repoData));
      break;
    case 'review_requested':
      handlePullRequestReviewRequested(repoData, data).then(() => savePullyState(repoData));
      break;
    case 'converted_to_draft':
      handlePullRequestConvertedToDraft(repoData, data).then(() => savePullyState(repoData));
      break;
    case 'ready_for_review':
      handlePullRequestReadyForReview(repoData, data).then(() => savePullyState(repoData));
      break;
    case 'edited':
      handlePullRequestEdited(repoData, data).then(() => savePullyState(repoData));
      break;
    default:
      console.log(`Got unknown event to handle: ${data}`);
  }
});

// TODO: A better way to ship this for github would be to pack this inside a github action
