import { assertEquals } from "jsr:@std/assert";
import {
  bumpExistingPrsWithoutReview,
  REMINDER_MESSAGES,
} from "./bumpExistingPrsWithoutReview.ts";
import { GithubAdapter } from "./GithubAdapter.ts";
import { PullyData } from "./PullyData.ts";
import { PullyOptions } from "./PullyOptions.ts";
import { ReviewerState } from "./index.ts";

const pullyData: PullyData = { known_authors: [] };

const pullyOptions: PullyOptions = {
  PULLY_SLACK_TOKEN: "token",
  PULLY_SLACK_CHANNEL: "channel",
  PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE: false,
  PULLY_REVIEW_STATUS_ON_NEW_LINE: false,
  PULLY_HIDE_REVIEWS_WHEN_PR_CLOSED: false,
};

const yesterdayTs = `${Math.floor((Date.now() - 86_400_000) / 1000)}.000000`;

const makeAdapter = (
  overrides: Partial<GithubAdapter["platform_methods"]> = {},
): GithubAdapter => ({
  GITHUB_TOKEN: "token",
  GITHUB_REPOSITORY: "repo",
  GITHUB_REPOSITORY_OWNER: "owner",
  platform_methods: {
    listOpenPrs: async () => [1],
    getPrTitle: async () => "My feature",
    getPrReviews: async () => [],
    getReviewsRequestedForPr: async () => [],
    getExistingMessageTimestamp: async () => "1000000000.000000",
    getReminderTimestampsForPr: async () => [],
    addReminderTimestampForPr: async () => {},
    clearReminderTimestampsForPr: async () => {},
    updateSlackMessageTimestampForPr: async () => undefined,
    loadPullyUserConfig: async () => pullyData,
    isPrDraft: () => Promise.resolve(true),
    ...overrides,
  },
});

Deno.test("skips PR with a WIP title", async () => {
  let posted = false;
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getPrTitle: async () => "WIP: my feature",
    }),
    pullyOptions,
    async () => {
      posted = true;
      return undefined;
    },
  );

  assertEquals(posted, false);
});

Deno.test("skips PR when it has an approval", async () => {
  let posted = false;
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getPrReviews: async () => [{
        author: {},
        time: new Date(),
        state: "approved" as ReviewerState,
      }],
    }),
    pullyOptions,
    async () => {
      posted = true;
      return undefined;
    },
  );

  assertEquals(posted, false);
});

Deno.test("skips PR when it has a change request", async () => {
  let posted = false;
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getPrReviews: async () => [{
        author: {},
        time: new Date(),
        state: "requested-changes" as ReviewerState,
      }],
    }),
    pullyOptions,
    async () => {
      posted = true;
      return undefined;
    },
  );

  assertEquals(posted, false);
});

Deno.test("skips PR with no existing slack message", async () => {
  let posted = false;
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getExistingMessageTimestamp: async () => undefined,
    }),
    pullyOptions,
    async () => {
      posted = true;
      return undefined;
    },
  );

  assertEquals(posted, false);
});

Deno.test("skips PR when 5 reminders already sent", async () => {
  let posted = false;
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getReminderTimestampsForPr: async () => [
        yesterdayTs,
        yesterdayTs,
        yesterdayTs,
        yesterdayTs,
        yesterdayTs,
      ],
    }),
    pullyOptions,
    async () => {
      posted = true;
      return undefined;
    },
  );

  assertEquals(posted, false);
});

Deno.test("sends first reminder when no prior reminders", async () => {
  let sentMessage = "";
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter(),
    pullyOptions,
    async (message) => {
      sentMessage = message;
      return "reply.ts";
    },
  );

  assertEquals(sentMessage, REMINDER_MESSAGES[0]());
});

Deno.test("sends correct unique message based on prior reminder count", async () => {
  let sentMessage = "";
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getReminderTimestampsForPr:
        async () => [yesterdayTs, yesterdayTs, yesterdayTs],
    }),
    pullyOptions,
    async (message) => {
      sentMessage = message;
      return "reply.ts";
    },
  );

  assertEquals(sentMessage, REMINDER_MESSAGES[3]());
});

Deno.test("sends fifth (final) reminder after four prior", async () => {
  let sentMessage = "";
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getReminderTimestampsForPr:
        async () => [yesterdayTs, yesterdayTs, yesterdayTs, yesterdayTs],
    }),
    pullyOptions,
    async (message) => {
      sentMessage = message;
      return "reply.ts";
    },
  );

  assertEquals(sentMessage, REMINDER_MESSAGES[4]());
});

Deno.test("includes slack mention when review was requested", async () => {
  let sentMessage = "";
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      getReviewsRequestedForPr:
        async () => [{ slackMemberId: "U123", githubUsername: "bob" }],
    }),
    pullyOptions,
    async (message) => {
      sentMessage = message;
      return "reply.ts";
    },
  );

  assertEquals(sentMessage, REMINDER_MESSAGES[0]("<@U123>"));
});

Deno.test("stores the reply timestamp after sending", async () => {
  let storedTs = "";
  await bumpExistingPrsWithoutReview(
    pullyData,
    makeAdapter({
      addReminderTimestampForPr: async (_prNumber, ts) => {
        storedTs = ts;
      },
    }),
    pullyOptions,
    async () => "stored.ts",
  );

  assertEquals(storedTs, "stored.ts");
});
