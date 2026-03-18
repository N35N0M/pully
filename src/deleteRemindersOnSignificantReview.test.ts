import { assertEquals } from "jsr:@std/assert";
import { deleteRemindersOnSignificantReview } from "./deleteRemindersOnSignificantReview.ts";

const reminderTs = ["111.000", "222.000", "333.000"];

const makePlatformMethods = (overrides: {
  getReminderTimestampsForPr?: () => Promise<string[]>;
  clearReminderTimestampsForPr?: () => Promise<void>;
} = {}) => ({
  getReminderTimestampsForPr: async () => reminderTs,
  clearReminderTimestampsForPr: async () => {},
  ...overrides,
});

Deno.test("deletes reminders on approved review", async () => {
  const deleted: string[][] = [];
  await deleteRemindersOnSignificantReview(
    "approved",
    1,
    makePlatformMethods(),
    async (ts) => {
      deleted.push(ts);
    },
  );
  assertEquals(deleted, [reminderTs]);
});

Deno.test("deletes reminders on changes_requested review", async () => {
  const deleted: string[][] = [];
  await deleteRemindersOnSignificantReview(
    "changes_requested",
    1,
    makePlatformMethods(),
    async (ts) => {
      deleted.push(ts);
    },
  );
  assertEquals(deleted, [reminderTs]);
});

Deno.test("does not delete reminders on comment review", async () => {
  const deleted: string[][] = [];
  await deleteRemindersOnSignificantReview(
    "commented",
    1,
    makePlatformMethods(),
    async (ts) => {
      deleted.push(ts);
    },
  );
  assertEquals(deleted, []);
});

Deno.test("clears stored reminder timestamps on approved review", async () => {
  let cleared = false;
  await deleteRemindersOnSignificantReview(
    "approved",
    1,
    makePlatformMethods({
      clearReminderTimestampsForPr: async () => {
        cleared = true;
      },
    }),
    async () => {},
  );
  assertEquals(cleared, true);
});

Deno.test("does not clear stored reminder timestamps on comment review", async () => {
  let cleared = false;
  await deleteRemindersOnSignificantReview(
    "commented",
    1,
    makePlatformMethods({
      clearReminderTimestampsForPr: async () => {
        cleared = true;
      },
    }),
    async () => {},
  );
  assertEquals(cleared, false);
});
