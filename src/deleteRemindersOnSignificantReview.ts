interface ReminderMethods {
  getReminderTimestampsForPr: (prNumber: number) => Promise<string[]>;
  clearReminderTimestampsForPr: (prNumber: number) => Promise<void>;
}

export const deleteRemindersOnSignificantReview = async (
  reviewState: string,
  prNumber: number,
  platformMethods: ReminderMethods,
  deleteMessages: (timestamps: string[]) => Promise<void>,
) => {
  const isSignificant = reviewState === "approved" ||
    reviewState === "changes_requested";
  if (!isSignificant) return;
  const timestamps = await platformMethods.getReminderTimestampsForPr(prNumber);
  await deleteMessages(timestamps);
  await platformMethods.clearReminderTimestampsForPr(prNumber);
};
