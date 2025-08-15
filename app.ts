// These are the dependencies for this file.
//
// You installed the `dotenv` and `octokit` modules earlier. The `@octokit/webhooks` is a dependency of the `octokit` module, so you don't need to install it separately. The `fs` and `http` dependencies are built-in Node.js modules.
import dotenv from "dotenv";
import { App, Octokit } from "octokit";
import {
	createNodeMiddleware,
	EmitterWebhookEventName,
	Webhooks,
} from "@octokit/webhooks";
import fs, { readFileSync } from "fs";
import http from "http";
import { PullRequestOpenedEvent } from "@octokit/webhooks-types";
import { HandlerFunction } from "@octokit/webhooks/types";
import { WebClient } from "@slack/web-api";

// This reads your `.env` file and adds the variables from that file to the `process.env` object in Node.js.
dotenv.config();

// This assigns the values of your environment variables to local variables.
const appId = process.env.APP_ID as string;
const webhookSecret = process.env.WEBHOOK_SECRET as string;
const privateKeyPath = process.env.PRIVATE_KEY_PATH as string;
const token = process.env.SLACK_TOKEN as string;
const testChannel = process.env.CHANNEL as string;

// Initialize
const web = new WebClient(token);
// This reads the contents of your private key file.
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// This creates a new instance of the Octokit App class.
const app = new App({
	appId: appId,
	privateKey: privateKey,
	webhooks: {
		secret: webhookSecret,
	},
});

type prNumber = number;
type messageTimestamp = string;

// TODO: These three maps needs some refinement as we are going to mess this up... Should maybe have a person object and collect the three instead...

/**
 * Replace with your own info. Not really considering this sensitive so will just commit to have a working example (for me;D)
 */
const githubToSlackUsernames: Map<string, string> = new Map([

]);

const githubToFirstname: Map<string, string> = new Map([

]);

const slackUsernameToFirstname: Map<string, string> = new Map([

]);

// This sets up a webhook event listener. When your app receives a webhook event from GitHub with a `X-GitHub-Event` header value of `pull_request` and an `action` payload value of `opened`, it calls the `handlePullRequestOpened` event handler that is defined above.
function addWebhook<E extends EmitterWebhookEventName>(
	webhooks: Webhooks,
	event: E | E[],
	callback: HandlerFunction<E, unknown>,
) {
	webhooks.on(event, callback);
}

type prState = "opened" | "closed" | "merged";
type reviewerState =
	| "approved"
	| "requested-changes"
	| "review_requested"
	| "dismissed";

type username = string;
type reviewers = Record<username, reviewerState>;
type prReviewData = Record<prNumber, reviewers>;

type repoFullName = string;

// The reason why we keep a local state instead of just scraping repos for data all the time is that it
// requires more access privileges (instead of just being able to see pr-related webhook payloads)
const repodatafile = "repodata.json";
const messagedatafile = "messagedata.json";

interface IRepoData {
  reviews: prReviewData
  messages: Record<prNumber, messageTimestamp>
}

let repoData: Record<repoFullName, IRepoData> = {};

try {
  // TODO: Should sanitize json data
	repoData = JSON.parse(readFileSync(repodatafile, "utf-8"));
	console.log(repoData);

} catch {
	console.warn("No data.json found, starting state from scratch...");
}



const saveState = (
) => {
	console.log(repoData);
	fs.writeFileSync(repodatafile, JSON.stringify(repoData));
	console.log("SaveState called");
};

const attemptTranslatingFromGithubToSlackUser = (githubLogin: string) => {
	if (githubToSlackUsernames.has(githubLogin)) {
		// https://api.slack.com/reference/surfaces/formatting#mentioning-users
		return `<@${githubToSlackUsernames.get(githubLogin)}>`;
	}

	return githubLogin;
};

const attemptTranslatingFromGithubToFirstname = (githubLogin: string) => {
	if (githubToFirstname.has(githubLogin)) {
		return `${githubToFirstname.get(githubLogin)}`;
	}

	return githubLogin;
};

const attemptTranslatingFromSlackTagToFirstname = (slackMention: string) => {
	if (slackUsernameToFirstname.has(slackMention)) {
		return `${slackUsernameToFirstname.get(slackMention)}`;
	}

	return slackMention;
};

const formatPayload = (
	author: string,
	prTitle: string,
	prNumber: number,
	state: prState,
	repo: string,
	url: string,
	lineAdds?: number,
	lineRemovals?: number,
) => {
	let authorToUse = attemptTranslatingFromGithubToFirstname(author);

	let statusSlackmoji = "";
	switch (state) {
		case "closed":
			statusSlackmoji = ":github-closed:";
			break;
		case "opened":
			statusSlackmoji = ":github-pr:";
			break;
		case "merged":
			statusSlackmoji = ":github-merged:";
	}

	let linediff = "";
	if (lineAdds !== undefined && lineRemovals !== undefined) {
		linediff = `(+${lineAdds}/-${lineRemovals})`;
	}

	// Main info
	let text = `<${url}|[${repo}] ${prTitle} (#${prNumber})> ${linediff} by ${authorToUse}`;

	if (repo in repoData) {
		const specificRepoData = repoData[repo];

		if (prNumber in specificRepoData.reviews) {
			const prReviewData = specificRepoData.reviews[prNumber];

			const approvers = new Set();
			const change_requesters = new Set();
			const review_requests = new Set();

			for (let [reviewer, state] of Object.entries(prReviewData)) {
				switch (state) {
					case "approved":
						approvers.add(attemptTranslatingFromSlackTagToFirstname(reviewer));
						break;
					case "requested-changes":
						change_requesters.add(
							attemptTranslatingFromSlackTagToFirstname(reviewer),
						);
						break;
					case "review_requested":
						review_requests.add(reviewer); // Only give @ mentions when a review is requested to avoid notification spam
				}
			}

			if (approvers.size !== 0) {
				text += " | :github-approve: " + Array.from(approvers).join(", ");
			}

			if (state === "opened") {
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

	if (state === "closed" || state === "merged") {
		text = `~${text}~`;
	}

	text = `${statusSlackmoji} ${text}`;

	return text;
};

const ensureStateIsInitialized = (repoFullName: string, prNumber: number) => {
	if (!(repoFullName in repoData)) {
		repoData[repoFullName] = { reviews: {}, messages: {}};
	}

	const specificRepoData = repoData[repoFullName].reviews;

	if (!(prNumber in specificRepoData)) {
		specificRepoData[prNumber] = {};
	}
};

addWebhook(app.webhooks, "pull_request_review.submitted", async (options) => {
	console.log("Received a pull request review submitted event");
	ensureStateIsInitialized(
		options.payload.repository.full_name,
		options.payload.pull_request.number,
	);

	const specificPrData = repoData
		[options.payload.repository.full_name].reviews
		[options.payload.pull_request.number];

  const existingMessages = repoData
		[options.payload.repository.full_name].messages

	const author = attemptTranslatingFromGithubToSlackUser(
		options.payload.review.user?.login ?? "undefined",
	);

	switch (options.payload.review.state) {
		case "approved":
			specificPrData[author] = "approved"
			break;
		case "changes_requested":
			specificPrData[author] = "requested-changes"
			break;
		case "dismissed":
			specificPrData[author] = "dismissed";
	}

	const prNumber = options.payload.pull_request.number;
	const prData = options.payload.pull_request;
	const payload = formatPayload(
		prData.user?.login ?? "undefined",
		prData.title,
		prData.number,
		prData.state === "open" ? "opened" : "closed",
		options.payload.repository.full_name,
		prData.html_url,
		undefined,
		undefined,
	);
	if (prNumber in existingMessages) {
		web.chat.update({
			text: payload,
			channel: testChannel,
			ts: existingMessages[prNumber],
		});
	} else {
		const value = await web.chat.postMessage({
			text: payload,
			channel: testChannel,
		});
		if (value.ts) {
			existingMessages[prNumber] = value.ts;
		}
	}

	saveState();
});

addWebhook(app.webhooks, "pull_request.review_requested", async (options) => {
    	ensureStateIsInitialized(
		options.payload.repository.full_name,
		options.payload.pull_request.number,
	);
	const specificPrData = repoData
		[options.payload.repository.full_name].reviews[options.payload.pull_request.number];


  const existingMessages = repoData
		[options.payload.repository.full_name].messages

	if (options.payload.requested_reviewer) {
		const author = attemptTranslatingFromGithubToSlackUser(
			options.payload.requested_reviewer.login,
		);
		specificPrData[author] = "review_requested";
	}

	const prNumber = options.payload.pull_request.number;
	const prData = options.payload.pull_request;
	const payload = formatPayload(
		prData.user?.login ?? "undefined",
		prData.title,
		prData.number,
		prData.state === "open" ? "opened" : "closed",
		options.payload.repository.full_name,
		prData.html_url,
		prData.additions,
		prData.deletions,
	);
	if (prNumber in existingMessages) {
		web.chat.update({
			text: payload,
			channel: testChannel,
			ts: existingMessages[prNumber],
		});
	} else {
		const value = await web.chat.postMessage({
			text: payload,
			channel: testChannel,
		});
		if (value.ts) {
			existingMessages[prNumber] = value.ts;
		}
	}

	saveState();
});

addWebhook(app.webhooks, "pull_request.opened", async (options) => {
	console.log(
		`Received a pull request event for #${options.payload.pull_request.url}`,
	);
	ensureStateIsInitialized(
		options.payload.repository.full_name,
		options.payload.pull_request.number,
	);
	const prNumber = options.payload.pull_request.number;
	const prData = options.payload.pull_request;

  const existingMessages = repoData
		[options.payload.repository.full_name].messages

	// TODO: We should perhaps not assume that open is the first time that this logic sees this pr... (what if PRs already exist?)
	const value = await web.chat.postMessage({
		text: formatPayload(
			prData.user.login,
			prData.title,
			prData.number,
			"opened",
			options.payload.repository.full_name,
			prData.html_url,
			prData.additions,
			prData.deletions,
		),
		channel: testChannel,
	});
	if (value.ts) {
		existingMessages[prNumber] = value.ts;
	}

	saveState();
});

addWebhook(app.webhooks, "pull_request.closed", async (options) => {
	console.log(
		`Received a pull request closed event for ${options.payload.pull_request.url}`,
	);
	ensureStateIsInitialized(
		options.payload.repository.full_name,
		options.payload.pull_request.number,
	);
  const existingMessages = repoData
		[options.payload.repository.full_name].messages
	const prNumber = options.payload.pull_request.number;
	const prData = options.payload.pull_request;
	const payload = formatPayload(
		prData.user.login,
		prData.title,
		prData.number,
		"closed",
		options.payload.repository.full_name,
		prData.html_url,
		prData.additions,
		prData.deletions,
	);
	if (prNumber in existingMessages) {
		web.chat.update({
			text: payload,
			channel: testChannel,
			ts: existingMessages[prNumber],
		});
	} else {
		const value = await web.chat.postMessage({
			text: payload,
			channel: testChannel,
		});
		if (value.ts) {
			existingMessages[prNumber] = value.ts;
		}
		saveState();
	}
});

// This logs any errors that occur.
app.webhooks.onError((error) => {
	if (error.name === "AggregateError") {
		console.error(`Error processing request: ${error.event}`);
	} else {
		console.error(error);
	}
});

// This determines where your server will listen.
//
// For local development, your server will listen to port 3000 on `localhost`. When you deploy your app, you will change these values. For more information, see [Deploy your app](#deploy-your-app).
const port = 3000;
const host = "localhost";
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;

// This sets up a middleware function to handle incoming webhook events.
//
// Octokit's `createNodeMiddleware` function takes care of generating this middleware function for you. The resulting middleware function will:
//
//    - Check the signature of the incoming webhook event to make sure that it matches your webhook secret. This verifies that the incoming webhook event is a valid GitHub event.
//    - Parse the webhook event payload and identify the type of event.
//    - Trigger the corresponding webhook event handler.
const middleware = createNodeMiddleware(app.webhooks, { path });

// This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
http.createServer(middleware).listen(port, () => {
	console.log(`Server is listening for events at: ${localWebhookUrl}`);
	console.log("Press Ctrl + C to quit.");
});
