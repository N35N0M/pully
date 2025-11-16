"use strict";
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
exports.constructSlackMessage = void 0;
var node_assert_1 = require("node:assert");
var getAuthorInfoFromGithubLogin_ts_1 = require("./getAuthorInfoFromGithubLogin.ts");
var constructSlackMessage = function (github_adapter, pully_options, pullyRepodataCache, author, prTitle, prNumber, prState, repoOwner, repoName, prUrl, lineAdds, lineRemovals) { return __awaiter(void 0, void 0, void 0, function () {
    var authorToUse, prStatusSlackmoji, linediff, repoDisplayName, prDescription, generateSlackLink, repoNameFormatted, authorSlackmoji, prReviews, reviewRequests, reviews, _i, _a, request, _b, prReviews_1, review, timestamp, approvers, change_requesters, review_requests, _c, _d, _e, reviewer, state, reviewerData, reviewStatusText, leftHandSideTextLength, desiredLength, leftHandSideText, slackMessage;
    var _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0:
                authorToUse = (_f = author.firstName) !== null && _f !== void 0 ? _f : author.githubUsername;
                prStatusSlackmoji = "";
                switch (prState) {
                    case "closed":
                        prStatusSlackmoji = ":github-closed:";
                        break;
                    case "open":
                        prStatusSlackmoji = ":github-pr:";
                        break;
                    case "merged":
                        prStatusSlackmoji = ":github-merged:";
                        break;
                    case "draft":
                        prStatusSlackmoji = ":github-pr-draft:";
                        break;
                }
                linediff = "";
                if (lineAdds !== undefined && lineRemovals !== undefined) {
                    linediff = "(+".concat(lineAdds, "/-").concat(lineRemovals, ")");
                }
                repoDisplayName = "".concat(repoOwner, "/").concat(repoName);
                if (pully_options.PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE) {
                    repoDisplayName = repoName;
                }
                prDescription = "".concat(prTitle.replaceAll(">", ""), " (#").concat(prNumber, ") ").concat(linediff, " by ").concat(authorToUse);
                generateSlackLink = function (url, displayText) {
                    return "<".concat(url, "|").concat(displayText, ">");
                };
                repoNameFormatted = "[".concat(repoDisplayName, "]");
                authorSlackmoji = "";
                if (author.slackmoji) {
                    authorSlackmoji = " ".concat(author.slackmoji);
                }
                return [4 /*yield*/, github_adapter.platform_methods.getPrReviews(pullyRepodataCache, prNumber)];
            case 1:
                prReviews = _m.sent();
                return [4 /*yield*/, github_adapter.platform_methods.getReviewsRequestedForPr(pullyRepodataCache, prNumber)];
            case 2:
                reviewRequests = _m.sent();
                reviews = {};
                // According to the docs, requested_reviewers clear when they submit a review.
                // The API has no timestamp info for the review request, so we got to trust that
                // and just set a dummy timestamp that is guaranteed to be lower than current time.
                for (_i = 0, _a = reviewRequests.reverse(); _i < _a.length; _i++) {
                    request = _a[_i];
                    reviews[(_h = (_g = request.githubUsername) !== null && _g !== void 0 ? _g : request.firstName) !== null && _h !== void 0 ? _h : ''] = {
                        state: "review_requested",
                        timestamp: new Date(0),
                    };
                }
                // If the reviewer doesnt have an active review request, they might have a review going
                for (_b = 0, prReviews_1 = prReviews; _b < prReviews_1.length; _b++) {
                    review = prReviews_1[_b];
                    if (((_j = review.author) === null || _j === void 0 ? void 0 : _j.githubUsername) !== undefined) {
                        timestamp = review.time;
                        if (!(review.author.githubUsername in reviews) ||
                            (review.author.githubUsername in reviews &&
                                reviews[review.author.githubUsername].state !== "review_requested" &&
                                (reviews[review.author.githubUsername].timestamp < timestamp))) {
                            reviews[review.author.githubUsername] = {
                                state: review.state,
                                timestamp: timestamp,
                            };
                        }
                    }
                }
                approvers = new Set();
                change_requesters = new Set();
                review_requests = new Set();
                for (_c = 0, _d = Object.entries(reviews); _c < _d.length; _c++) {
                    _e = _d[_c], reviewer = _e[0], state = _e[1];
                    reviewerData = (0, getAuthorInfoFromGithubLogin_ts_1.getAuthorInfoFromGithubLogin)(pullyRepodataCache.known_authors, reviewer);
                    switch (state.state) {
                        case "approved":
                            approvers.add("".concat((_k = reviewerData.firstName) !== null && _k !== void 0 ? _k : reviewerData.githubUsername).concat(reviewerData.slackmoji
                                ? " ".concat(reviewerData.slackmoji)
                                : ""));
                            break;
                        case "requested-changes":
                            change_requesters.add("".concat((_l = reviewerData.firstName) !== null && _l !== void 0 ? _l : reviewerData.githubUsername).concat(reviewerData.slackmoji
                                ? " ".concat(reviewerData.slackmoji)
                                : ""));
                            break;
                        case "review_requested":
                            // Only give @ mentions when a review is requested to avoid notification spam
                            review_requests.add("<@".concat(reviewerData.slackMemberId, ">"));
                    }
                }
                reviewStatusText = "";
                if (approvers.size !== 0) {
                    reviewStatusText += " | :github-approve: " +
                        Array.from(approvers).join(", ");
                }
                if (prState === "open") {
                    if (change_requesters.size !== 0) {
                        reviewStatusText += " | :github-changes-requested: " +
                            Array.from(change_requesters).join(", ");
                    }
                    if (review_requests.size !== 0) {
                        reviewStatusText += " | :code-review: " +
                            Array.from(review_requests).join(", ");
                    }
                }
                leftHandSideTextLength = repoDisplayName.length + prDescription.length;
                if (author.slackmoji) {
                    leftHandSideTextLength += 2; // One space and one rendered slackmoji
                }
                if (leftHandSideTextLength > pully_options.max_length_left_hand_side) {
                    desiredLength = pully_options.max_length_left_hand_side - repoNameFormatted.length - 2 - 2;
                    (0, node_assert_1.default)(desiredLength >= 0); // Just in case
                    prDescription = prDescription.slice(0, desiredLength);
                    prDescription += "...";
                }
                else if (leftHandSideTextLength < pully_options.max_length_left_hand_side) {
                    prDescription += authorSlackmoji;
                    prDescription = prDescription.padEnd(pully_options.max_length_left_hand_side + authorSlackmoji.length - 3 - repoNameFormatted.length, " ");
                }
                leftHandSideText = "".concat(generateSlackLink(prUrl, repoNameFormatted), " ").concat(prDescription);
                // Strikethrough
                if (prState === "closed" || prState === "merged") {
                    leftHandSideText = "~".concat(leftHandSideText, "~");
                }
                slackMessage = "".concat(prStatusSlackmoji, " ").concat(leftHandSideText).concat(reviewStatusText);
                return [2 /*return*/, slackMessage];
        }
    });
}); };
exports.constructSlackMessage = constructSlackMessage;
