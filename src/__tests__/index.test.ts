import { assert, assertEquals } from "jsr:@std/assert";
import {constructSlackMessage} from "../index.ts"

Deno.test("constructSlackMessage shall truncate messages less than configured max", async () => {
    const result = await constructSlackMessage(
        {
            GITHUB_TOKEN: "totallyrealgithubtoken",
            GITHUB_REPOSITORY: "pully",
            GITHUB_REPOSITORY_OWNER: "N35N0M",
            platform_methods: {
                getReviewsRequestedForPr: (pullyCache, prNumber) => Promise.resolve([]),
                getPrReviews: (pullyCache, prNumber) => Promise.resolve([])
            }
        },
        {
            PULLY_SLACK_CHANNEL: "fakeslackchannelid",
            PULLY_SLACK_TOKEN: "fakeslacktoken",
            max_length_left_hand_side: 100
        },
        {known_authors: [
            {
                firstName: "Kris",
                slackMemberId: "12345",
                slackmoji: ":totally-a-slackmoji",
                githubUsername: "n35n0m"
            }
        ]},
        {},
        "My PR title",
        1,
        "open",
        "n35n0m",
        "pully",
        "https://github.com/N35N0M/pully/pull/19",
        12,
        13
    );

    console.log(result)

    assert(result === "teehee")
})