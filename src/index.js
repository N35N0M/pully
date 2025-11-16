"use strict";
// TODO: Need cleanup support after a PR is merged to avoid having lots of dead files in state
// TODO: We need history from time to time
// TODO: Opt-in daily summary in the morning of workdays
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var web_api_1 = require("@slack/web-api");
var node_assert_1 = require("node:assert");
var octokit_1 = require("octokit");
var core = require("@actions/core");
var github = require("@actions/github");
var constructSlackMessage_ts_1 = require("./constructSlackMessage.ts");
var getAuthorInfoFromGithubLogin_ts_1 = require("./getAuthorInfoFromGithubLogin.ts");
var postToSlack = function (slackMessageContent, prNumber, isDraft, githubAdapter, pullyOptions) { return __awaiter(void 0, void 0, void 0, function () {
    var postingInitialDraftsRequested, web, octokit, existingMessageTimestamp, messagePath, pullyStateRaw, timestampFile, e_1, isInitialDraft, value;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                postingInitialDraftsRequested = core.getInput("POST_INITIAL_DRAFT") !== "";
                web = new web_api_1.WebClient(pullyOptions.PULLY_SLACK_TOKEN);
                octokit = new octokit_1.Octokit({ auth: githubAdapter.GITHUB_TOKEN });
                messagePath = "messages/".concat(githubAdapter.GITHUB_REPOSITORY_OWNER, "_").concat(githubAdapter.GITHUB_REPOSITORY, "_").concat(prNumber, ".timestamp");
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                        repo: githubAdapter.GITHUB_REPOSITORY,
                        owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
                        path: messagePath,
                        ref: "refs/heads/pully-persistent-state-do-not-use-for-coding",
                    })];
            case 2:
                pullyStateRaw = _a.sent();
                timestampFile = JSON.parse(
                // @ts-expect-error need to assert that this is file somehow
                atob(pullyStateRaw.data.content));
                existingMessageTimestamp = timestampFile.timestamp;
                return [3 /*break*/, 4];
            case 3:
                e_1 = _a.sent();
                console.log("Error when getting existing timestamp...");
                console.log(e_1); // Assuming file not found
                return [3 /*break*/, 4];
            case 4:
                isInitialDraft = isDraft && existingMessageTimestamp === undefined;
                if (isInitialDraft && !postingInitialDraftsRequested) {
                    return [2 /*return*/];
                }
                if (!existingMessageTimestamp) return [3 /*break*/, 5];
                web.chat.update({
                    text: slackMessageContent,
                    channel: pullyOptions.PULLY_SLACK_CHANNEL,
                    ts: existingMessageTimestamp,
                });
                return [3 /*break*/, 8];
            case 5: return [4 /*yield*/, web.chat.postMessage({
                    text: slackMessageContent,
                    channel: pullyOptions.PULLY_SLACK_CHANNEL,
                })];
            case 6:
                value = _a.sent();
                if (!value.ts) return [3 /*break*/, 8];
                return [4 /*yield*/, octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
                        owner: githubAdapter.GITHUB_REPOSITORY_OWNER,
                        repo: githubAdapter.GITHUB_REPOSITORY,
                        path: messagePath,
                        branch: "refs/heads/pully-persistent-state-do-not-use-for-coding",
                        message: "Pully state update",
                        committer: {
                            name: "Pully",
                            email: "kris@bitheim.no",
                        },
                        content: btoa(JSON.stringify({ timestamp: value.ts })),
                        // sha: sha, We will never update the file since we have one message per pr...
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28",
                        },
                    })];
            case 7:
                _a.sent();
                _a.label = 8;
            case 8: return [2 /*return*/];
        }
    });
}); };
var handlePullRequestReviewSubmitted = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    var prAuthor, prData, prStatus, slackMessage;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log("Received a pull request review submitted event");
                prAuthor = (0, getAuthorInfoFromGithubLogin_ts_1.getAuthorInfoFromGithubLogin)(pullyRepodataCache.known_authors, (_b = (_a = payload.pull_request.user) === null || _a === void 0 ? void 0 : _a.login) !== null && _b !== void 0 ? _b : "undefined");
                prData = payload.pull_request;
                prStatus = prData.state;
                // Handle special states
                if (!prData.merged_at && prData.state == "closed") {
                    prStatus = "closed";
                }
                else if (!!prData.merged_at) {
                    prStatus = "merged";
                }
                else if (prData.draft) {
                    prStatus = "draft";
                }
                return [4 /*yield*/, (0, constructSlackMessage_ts_1.constructSlackMessage)(github_adapter, pully_options, pullyRepodataCache, prAuthor, prData.title, prData.number, prStatus, payload.repository.owner.login, payload.repository.name, prData.html_url, undefined, undefined)];
            case 1:
                slackMessage = _c.sent();
                return [4 /*yield*/, postToSlack(slackMessage, prData.number, prStatus === "draft", github_adapter, pully_options)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); };
var handlePullRequestReviewRequested = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        handlePullRequestGeneric(pullyRepodataCache, payload, github_adapter, pully_options);
        return [2 /*return*/];
    });
}); };
var handlePullRequestGeneric = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    var prData, author, prStatus, slackMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                prData = payload.pull_request;
                author = (0, getAuthorInfoFromGithubLogin_ts_1.getAuthorInfoFromGithubLogin)(pullyRepodataCache.known_authors, prData.user.login);
                prStatus = prData.state;
                // Handle special states
                if (!prData.merged && prStatus == "closed") {
                    prStatus = "closed";
                }
                else if (!!prData.merged) {
                    prStatus = "merged";
                }
                else if (prData.draft) {
                    prStatus = "draft";
                }
                return [4 /*yield*/, (0, constructSlackMessage_ts_1.constructSlackMessage)(github_adapter, pully_options, pullyRepodataCache, author, prData.title, prData.number, prStatus, payload.repository.owner.login, payload.repository.name, prData.html_url, prData.additions, prData.deletions)];
            case 1:
                slackMessage = _a.sent();
                return [4 /*yield*/, postToSlack(slackMessage, prData.number, prStatus === "draft", github_adapter, pully_options)];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var handlePullRequestOpened = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request open event for #".concat(payload.pull_request.url));
                return [4 /*yield*/, handlePullRequestGeneric(pullyRepodataCache, payload, github_adapter, pully_options)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var handlePullRequestReopened = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request reopened event for #".concat(payload.pull_request.url));
                return [4 /*yield*/, handlePullRequestGeneric(pullyRepodataCache, payload, github_adapter, pully_options)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var handlePullRequestEdited = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request edited event for #".concat(payload.pull_request.url));
                return [4 /*yield*/, handlePullRequestGeneric(pullyRepodataCache, payload, github_adapter, pully_options)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var handlePullRequestConvertedToDraft = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request converted to draft event for #".concat(payload.pull_request.url));
                return [4 /*yield*/, handlePullRequestGeneric(pullyRepodataCache, payload, github_adapter, pully_options)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var handlePullRequestReadyForReview = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request ready for review event for #".concat(payload.pull_request.url));
                return [4 /*yield*/, handlePullRequestGeneric(pullyRepodataCache, payload, github_adapter, pully_options)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var handlePullRequestClosed = function (pullyRepodataCache, payload, github_adapter, pully_options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request closed event for ".concat(payload.pull_request.url));
                return [4 /*yield*/, handlePullRequestGeneric(pullyRepodataCache, payload, github_adapter, pully_options)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var loadPullyState = function (github_adapter) { return __awaiter(void 0, void 0, void 0, function () {
    var repoData, octokit, pullyStateRaw, e_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                octokit = new octokit_1.Octokit({ auth: github_adapter.GITHUB_TOKEN });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                        repo: github_adapter.GITHUB_REPOSITORY,
                        owner: github_adapter.GITHUB_REPOSITORY_OWNER,
                        path: "pullystate.json",
                        ref: "refs/heads/pully-persistent-state-do-not-use-for-coding",
                    })];
            case 2:
                pullyStateRaw = _a.sent();
                // @ts-expect-error need to assert that this is file somehow
                repoData = JSON.parse(atob(pullyStateRaw.data.content));
                return [2 /*return*/, repoData];
            case 3:
                e_2 = _a.sent();
                throw e_2;
            case 4: return [2 /*return*/];
        }
    });
}); };
var savePullyState = function (pullyState, github_adapter) { return __awaiter(void 0, void 0, void 0, function () {
    var octokit, pullyStateRaw, sha;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                octokit = new octokit_1.Octokit({ auth: github_adapter.GITHUB_TOKEN });
                return [4 /*yield*/, octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                        repo: github_adapter.GITHUB_REPOSITORY,
                        owner: github_adapter.GITHUB_REPOSITORY_OWNER,
                        path: "pullystate.json",
                        ref: "refs/heads/pully-persistent-state-do-not-use-for-coding",
                    })];
            case 1:
                pullyStateRaw = _a.sent();
                sha = pullyStateRaw.data.sha;
                return [4 /*yield*/, octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
                        owner: github_adapter.GITHUB_REPOSITORY_OWNER,
                        repo: github_adapter.GITHUB_REPOSITORY,
                        path: "pullystate.json",
                        branch: "refs/heads/pully-persistent-state-do-not-use-for-coding",
                        message: "Pully state update",
                        committer: {
                            name: "Pully",
                            email: "kris@bitheim.no",
                        },
                        content: btoa(JSON.stringify(pullyState)),
                        sha: sha,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28",
                        },
                    })];
            case 2:
                _a.sent();
                console.log("Saved state");
                return [2 /*return*/];
        }
    });
}); };
var main = function () {
    var _a, _b;
    var eventName = github.context.eventName;
    core.info("The eventName: ".concat(eventName));
    console.log(github.context);
    // Environment variables
    // TODO: Make sure not to require github if we are actually making this vendor-agnostic at some point..
    var GITHUB_REPOSITORY_OWNER = (_a = github.context.payload.repository) === null || _a === void 0 ? void 0 : _a.owner.login;
    var GITHUB_REPOSITORY = (_b = github.context.payload.repository) === null || _b === void 0 ? void 0 : _b.name;
    var GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
    (0, node_assert_1.default)(!!GITHUB_TOKEN, "GITHUB_TOKEN was undefined in the environment! This must be set to a token with read and write access to the repo's pully-persistent-state-do-not-use-for-coding branch");
    (0, node_assert_1.default)(!!GITHUB_REPOSITORY_OWNER, "GITHUB_REPOSITORY_OWNER, i.e. the owner of the repo this is running for, was unexpectedly undefined in the runtime environment!");
    (0, node_assert_1.default)(!!GITHUB_REPOSITORY, "GITHUB_REPOSITORY, i.e. <owner/reponame> from github, was unexpectedly undefined in the runtime environment.");
    var PULLY_SLACK_TOKEN = core.getInput("PULLY_SLACK_TOKEN");
    var PULLY_SLACK_CHANNEL = core.getInput("PULLY_SLACK_CHANNEL");
    (0, node_assert_1.default)(!!PULLY_SLACK_TOKEN, "PULLY_SLACK_TOKEN was not defined in the environment");
    (0, node_assert_1.default)(!!PULLY_SLACK_CHANNEL, "PULLY_SLACK_CHANNEL (the slack channel id) was not defined in the environment");
    var pullyOptions = {
        PULLY_SLACK_CHANNEL: PULLY_SLACK_CHANNEL,
        PULLY_SLACK_TOKEN: PULLY_SLACK_TOKEN,
        PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE: core.getInput("PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE") !== ""
    };
    var githubAdapter = {
        GITHUB_TOKEN: GITHUB_TOKEN,
        GITHUB_REPOSITORY: GITHUB_REPOSITORY,
        GITHUB_REPOSITORY_OWNER: GITHUB_REPOSITORY_OWNER,
        platform_methods: {
            getReviewsRequestedForPr: function (pullyData, prNumber) { return __awaiter(void 0, void 0, void 0, function () {
                var octokit, reviewRequests;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            octokit = new octokit_1.Octokit({ auth: GITHUB_TOKEN });
                            return [4 /*yield*/, octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
                                    owner: GITHUB_REPOSITORY_OWNER,
                                    repo: GITHUB_REPOSITORY,
                                    pull_number: prNumber,
                                    headers: {
                                        "X-GitHub-Api-Version": "2022-11-28",
                                    },
                                })];
                        case 1:
                            reviewRequests = _a.sent();
                            return [2 /*return*/, reviewRequests.data.users.map(function (value) {
                                    return (0, getAuthorInfoFromGithubLogin_ts_1.getAuthorInfoFromGithubLogin)(pullyData.known_authors, value.login);
                                })];
                    }
                });
            }); },
            getPrReviews: function (pullyData, prNumber) { return __awaiter(void 0, void 0, void 0, function () {
                var octokit, prReviews;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            octokit = new octokit_1.Octokit({ auth: GITHUB_TOKEN });
                            return [4 /*yield*/, octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
                                    owner: GITHUB_REPOSITORY_OWNER,
                                    repo: GITHUB_REPOSITORY,
                                    pull_number: prNumber,
                                    headers: {
                                        "X-GitHub-Api-Version": "2022-11-28",
                                    },
                                })];
                        case 1:
                            prReviews = _a.sent();
                            return [2 /*return*/, prReviews.data.map(function (value) {
                                    var reviewType = "dismissed";
                                    if (value.state === "APPROVED") {
                                        reviewType = "approved";
                                    }
                                    else if (value.state === "REQUESTED_CHANGES") {
                                        reviewType = "requested-changes";
                                    }
                                    if (value.submitted_at === undefined) {
                                        throw Error("Review submitted at was unexpectedly undefined!");
                                    }
                                    return { author: (0, getAuthorInfoFromGithubLogin_ts_1.getAuthorInfoFromGithubLogin)(pullyData.known_authors, value.user.login), time: new Date(value.submitted_at), state: reviewType };
                                })];
                    }
                });
            }); },
        }
    };
    loadPullyState(githubAdapter).then(function (repoData) {
        var getEventData = function () {
            var eventData;
            // @ts-ignore TODO can we type narrow this to the correct type...?
            eventData = github.context.payload;
            return eventData;
        };
        var data = getEventData();
        // Then handle provided event payload (TODO to make this not strictly github based...)
        switch (data.action) {
            case "submitted":
                handlePullRequestReviewSubmitted(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            case "closed":
                handlePullRequestClosed(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            case "opened":
                handlePullRequestOpened(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            case "reopened":
                handlePullRequestReopened(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            case "review_requested":
                handlePullRequestReviewRequested(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            case "converted_to_draft":
                handlePullRequestConvertedToDraft(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            case "ready_for_review":
                handlePullRequestReadyForReview(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            case "edited":
                handlePullRequestEdited(repoData, data, githubAdapter, pullyOptions).then(function () {
                    return savePullyState(repoData, githubAdapter);
                });
                break;
            default:
                console.log("Got unknown event to handle: ".concat(data));
        }
    });
};
main();
