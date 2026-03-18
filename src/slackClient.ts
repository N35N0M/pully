const SLACK_API = "https://slack.com/api";

const slackPost = (
  token: string,
  endpoint: string,
  body: Record<string, string>,
) =>
  fetch(`${SLACK_API}/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

export const chatPostMessage = async (
  token: string,
  channel: string,
  text: string,
): Promise<string | undefined> => {
  const res = await slackPost(token, "chat.postMessage", { channel, text });
  const data = await res.json() as { ts?: string };
  return data.ts;
};

export const chatPostMessageInThread = async (
  token: string,
  channel: string,
  text: string,
  threadTs: string,
): Promise<string | undefined> => {
  const res = await slackPost(token, "chat.postMessage", {
    channel,
    text,
    thread_ts: threadTs,
    reply_broadcast: "true",
  });
  const data = await res.json() as { ts?: string };
  return data.ts;
};

export const chatUpdate = (
  token: string,
  channel: string,
  ts: string,
  text: string,
): Promise<Response> => slackPost(token, "chat.update", { channel, ts, text });

export const chatDelete = (
  token: string,
  channel: string,
  ts: string,
): Promise<Response> => slackPost(token, "chat.delete", { channel, ts });
