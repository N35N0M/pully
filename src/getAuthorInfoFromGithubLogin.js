"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthorInfoFromGithubLogin = void 0;
var getAuthorInfoFromGithubLogin = function (authorInfos, githubLogin) {
    var search = authorInfos.find(function (value) { return value.githubUsername === githubLogin; });
    if (search) {
        return search;
    }
    return {
        githubUsername: githubLogin,
        slackMemberId: undefined,
        firstName: undefined,
        slackmoji: undefined,
    };
};
exports.getAuthorInfoFromGithubLogin = getAuthorInfoFromGithubLogin;
