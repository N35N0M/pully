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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
import { readFileSync } from 'fs';
import { WebClient } from '@slack/web-api';
import assert from 'assert';
import { Octokit } from 'octokit';
import * as core from "@actions/core";
import * as github from "@actions/github";
var eventName = github.context.eventName;
core.info("The eventName: ".concat(eventName));
console.log(github.context);
var GITHUB_REPOSITORY_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
var GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
var GITHUB_TOKEN = process.env.GITHUB_TOKEN;
var GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
assert(!!GITHUB_REPOSITORY_OWNER, 'GITHUB_REPOSITORY_OWNER, i.e. the owner of the repo this is running for, was unexpectedly undefined in the runtime environment!');
assert(!!GITHUB_REPOSITORY, 'GITHUB_REPOSITORY, i.e. <owner/reponame> from github, was unexpectedly undefined in the runtime environment.');
assert(!!GITHUB_TOKEN, "GITHUB_TOKEN was undefined in the environment! This must be set to a token with read and write access to the repo's pully-persistent-state-do-not-use-for-coding branch");
assert(!!GITHUB_EVENT_PATH, 'GITHUB_EVENT_PATH was undefined in the environment! This should be provided by Github CI and is the same payload as the pull_request and pull_request_review webhooks: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request');
var PULLY_SLACK_TOKEN = process.env.PULLY_SLACK_TOKEN;
var PULLY_SLACK_CHANNEL = process.env.PULLY_SLACK_CHANNEL;
assert(!!PULLY_SLACK_TOKEN, 'PULLY_SLACK_TOKEN was not defined in the environment');
assert(!!PULLY_SLACK_CHANNEL, 'PULLY_SLACK_CHANNEL (the slack channel id) was not defined in the environment');
var GITHUB_REPOSITORY_WITHOUT_OWNER = GITHUB_REPOSITORY.replace("".concat(GITHUB_REPOSITORY_OWNER, "/"), '');
var postToSlack = function (slackMessageContent, prNumber) { return __awaiter(void 0, void 0, void 0, function () {
    var web, octokit, existingMessageTimestamp, messagePath, pullyStateRaw, timestampFile, e_1, value;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                web = new WebClient(PULLY_SLACK_TOKEN);
                octokit = new Octokit({ auth: GITHUB_TOKEN });
                messagePath = "messages/".concat(GITHUB_REPOSITORY_OWNER, "_").concat(GITHUB_REPOSITORY_WITHOUT_OWNER, "_").concat(prNumber, ".timestamp");
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4, octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                        repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
                        owner: GITHUB_REPOSITORY_OWNER,
                        path: messagePath,
                        ref: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
                    })];
            case 2:
                pullyStateRaw = _a.sent();
                timestampFile = JSON.parse(atob(pullyStateRaw.data.content));
                existingMessageTimestamp = timestampFile.timestamp;
                return [3, 4];
            case 3:
                e_1 = _a.sent();
                console.log('Error when getting existing timestamp...');
                console.log(e_1);
                return [3, 4];
            case 4:
                if (!existingMessageTimestamp) return [3, 5];
                web.chat.update({
                    text: slackMessageContent,
                    channel: PULLY_SLACK_CHANNEL,
                    ts: existingMessageTimestamp,
                });
                return [3, 8];
            case 5: return [4, web.chat.postMessage({
                    text: slackMessageContent,
                    channel: PULLY_SLACK_CHANNEL,
                })];
            case 6:
                value = _a.sent();
                if (!value.ts) return [3, 8];
                return [4, octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                        owner: GITHUB_REPOSITORY_OWNER,
                        repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
                        path: messagePath,
                        branch: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
                        message: 'Pully state update',
                        committer: {
                            name: 'Pully',
                            email: 'kris@bitheim.no',
                        },
                        content: btoa(JSON.stringify({ timestamp: value.ts })),
                        headers: {
                            'X-GitHub-Api-Version': '2022-11-28',
                        },
                    })];
            case 7:
                _a.sent();
                _a.label = 8;
            case 8: return [2];
        }
    });
}); };
var getAuthorInfoFromGithubLogin = function (authorInfos, githubLogin) {
    var search = authorInfos.find(function (value) { return value.githubUsername === githubLogin; });
    if (search) {
        return search;
    }
    return {
        githubUsername: githubLogin,
        slackMemberId: undefined,
        firstName: undefined,
    };
};
var constructSlackMessage = function (pullyRepodataCache, author, prTitle, prNumber, prState, repoFullname, prUrl, lineAdds, lineRemovals) { return __awaiter(void 0, void 0, void 0, function () {
    var authorToUse, statusSlackmoji, linediff, text, octokit, prReviews, reviewRequests, reviews, _a, _b, request, _c, _d, review, approvers, change_requesters, review_requests, _e, _f, _g, reviewer, state, reviewerData;
    var e_2, _h, e_3, _j, e_4, _k;
    var _l, _m, _o, _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
            case 0:
                authorToUse = (_l = author.firstName) !== null && _l !== void 0 ? _l : author.githubUsername;
                statusSlackmoji = '';
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
                linediff = '';
                if (lineAdds !== undefined && lineRemovals !== undefined) {
                    linediff = "(+".concat(lineAdds, "/-").concat(lineRemovals, ")");
                }
                text = "<".concat(prUrl, "|[").concat(repoFullname, "] ").concat(prTitle.replaceAll('>', ''), " (#").concat(prNumber, ")> ").concat(linediff, " by ").concat(authorToUse);
                octokit = new Octokit({ auth: GITHUB_TOKEN });
                return [4, octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
                        owner: GITHUB_REPOSITORY_OWNER,
                        repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
                        pull_number: prNumber,
                        headers: {
                            'X-GitHub-Api-Version': '2022-11-28',
                        },
                    })];
            case 1:
                prReviews = _q.sent();
                return [4, octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
                        owner: GITHUB_REPOSITORY_OWNER,
                        repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
                        pull_number: prNumber,
                        headers: {
                            'X-GitHub-Api-Version': '2022-11-28',
                        },
                    })];
            case 2:
                reviewRequests = _q.sent();
                reviews = {};
                try {
                    for (_a = __values(reviewRequests.data.users.reverse()), _b = _a.next(); !_b.done; _b = _a.next()) {
                        request = _b.value;
                        if (!(request.login in prReviews)) {
                            reviews[request.login] = 'review_requested';
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_h = _a.return)) _h.call(_a);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                try {
                    for (_c = __values(prReviews.data.reverse()), _d = _c.next(); !_d.done; _d = _c.next()) {
                        review = _d.value;
                        if (((_m = review.user) === null || _m === void 0 ? void 0 : _m.login) !== undefined) {
                            if (!(review.user.login in prReviews)) {
                                if (review.state === 'APPROVED') {
                                    reviews[review.user.login] = 'approved';
                                }
                                else if (review.state === 'CHANGES_REQUESTED') {
                                    reviews[review.user.login] = 'requested-changes';
                                }
                            }
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_j = _c.return)) _j.call(_c);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                approvers = new Set();
                change_requesters = new Set();
                review_requests = new Set();
                try {
                    for (_e = __values(Object.entries(reviews)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        _g = __read(_f.value, 2), reviewer = _g[0], state = _g[1];
                        reviewerData = getAuthorInfoFromGithubLogin(pullyRepodataCache.known_authors, reviewer);
                        switch (state) {
                            case 'approved':
                                approvers.add((_o = reviewerData.firstName) !== null && _o !== void 0 ? _o : reviewerData.githubUsername);
                                break;
                            case 'requested-changes':
                                change_requesters.add((_p = reviewerData.firstName) !== null && _p !== void 0 ? _p : reviewerData.githubUsername);
                                break;
                            case 'review_requested':
                                review_requests.add("<@".concat(reviewerData.slackMemberId, ">"));
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_k = _e.return)) _k.call(_e);
                    }
                    finally { if (e_4) throw e_4.error; }
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
                    text = "~".concat(text, "~");
                }
                text = "".concat(statusSlackmoji, " ").concat(text);
                return [2, text];
        }
    });
}); };
var handlePullRequestReviewSubmitted = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    var prAuthor, prData, slackMessage;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log('Received a pull request review submitted event');
                prAuthor = getAuthorInfoFromGithubLogin(pullyRepodataCache.known_authors, (_b = (_a = payload.pull_request.user) === null || _a === void 0 ? void 0 : _a.login) !== null && _b !== void 0 ? _b : 'undefined');
                prData = payload.pull_request;
                return [4, constructSlackMessage(pullyRepodataCache, prAuthor, prData.title, prData.number, prData.state, payload.repository.full_name, prData.html_url, undefined, undefined)];
            case 1:
                slackMessage = _c.sent();
                return [4, postToSlack(slackMessage, prData.number)];
            case 2:
                _c.sent();
                return [2];
        }
    });
}); };
var handlePullRequestReviewRequested = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        handlePullRequestGeneric(pullyRepodataCache, payload);
        return [2];
    });
}); };
var handlePullRequestGeneric = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    var prData, author, prStatus, slackMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                prData = payload.pull_request;
                author = getAuthorInfoFromGithubLogin(pullyRepodataCache.known_authors, prData.user.login);
                prStatus = prData.state;
                if (prData.draft) {
                    prStatus = 'draft';
                }
                if (prData.merged_at != null) {
                    prStatus = 'merged';
                }
                return [4, constructSlackMessage(pullyRepodataCache, author, prData.title, prData.number, prStatus, payload.repository.full_name, prData.html_url, prData.additions, prData.deletions)];
            case 1:
                slackMessage = _a.sent();
                return [4, postToSlack(slackMessage, prData.number)];
            case 2:
                _a.sent();
                return [2];
        }
    });
}); };
var handlePullRequestOpened = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request open event for #".concat(payload.pull_request.url));
                return [4, handlePullRequestGeneric(pullyRepodataCache, payload)];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); };
var handlePullRequestReopened = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request reopened event for #".concat(payload.pull_request.url));
                return [4, handlePullRequestGeneric(pullyRepodataCache, payload)];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); };
var handlePullRequestEdited = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request edited event for #".concat(payload.pull_request.url));
                return [4, handlePullRequestGeneric(pullyRepodataCache, payload)];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); };
var handlePullRequestConvertedToDraft = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request converted to draft event for #".concat(payload.pull_request.url));
                return [4, handlePullRequestGeneric(pullyRepodataCache, payload)];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); };
var handlePullRequestReadyForReview = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request ready for review event for #".concat(payload.pull_request.url));
                return [4, handlePullRequestGeneric(pullyRepodataCache, payload)];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); };
var handlePullRequestClosed = function (pullyRepodataCache, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Received a pull request closed event for ".concat(payload.pull_request.url));
                return [4, handlePullRequestGeneric(pullyRepodataCache, payload)];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); };
var loadPullyState = function () { return __awaiter(void 0, void 0, void 0, function () {
    var repoData, octokit, pullyStateRaw, e_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                octokit = new Octokit({ auth: GITHUB_TOKEN });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4, octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                        repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
                        owner: GITHUB_REPOSITORY_OWNER,
                        path: 'pullystate.json',
                        ref: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
                    })];
            case 2:
                pullyStateRaw = _a.sent();
                repoData = JSON.parse(atob(pullyStateRaw.data.content));
                return [2, repoData];
            case 3:
                e_5 = _a.sent();
                throw e_5;
            case 4: return [2];
        }
    });
}); };
var savePullyState = function (pullyState) { return __awaiter(void 0, void 0, void 0, function () {
    var octokit, pullyStateRaw, sha;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                octokit = new Octokit({ auth: GITHUB_TOKEN });
                return [4, octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                        repo: GITHUB_REPOSITORY_WITHOUT_OWNER,
                        owner: GITHUB_REPOSITORY_OWNER,
                        path: 'pullystate.json',
                        ref: 'refs/heads/pully-persistent-state-do-not-use-for-coding',
                    })];
            case 1:
                pullyStateRaw = _a.sent();
                sha = pullyStateRaw.data.sha;
                return [4, octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
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
                    })];
            case 2:
                _a.sent();
                console.log('Saved state');
                return [2];
        }
    });
}); };
loadPullyState().then(function (repoData) {
    var getEventData = function () {
        var eventData;
        try {
            eventData = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf-8'));
        }
        catch (_a) {
            throw Error('Could not read the github event payload, nothing to do here');
        }
        return eventData;
    };
    var data = getEventData();
    switch (data.action) {
        case 'submitted':
            handlePullRequestReviewSubmitted(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        case 'closed':
            handlePullRequestClosed(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        case 'opened':
            handlePullRequestOpened(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        case 'reopened':
            handlePullRequestReopened(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        case 'review_requested':
            handlePullRequestReviewRequested(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        case 'converted_to_draft':
            handlePullRequestConvertedToDraft(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        case 'ready_for_review':
            handlePullRequestReadyForReview(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        case 'edited':
            handlePullRequestEdited(repoData, data).then(function () { return savePullyState(repoData); });
            break;
        default:
            console.log("Got unknown event to handle: ".concat(data));
    }
});
//# sourceMappingURL=app.js.map