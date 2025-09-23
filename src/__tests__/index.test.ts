import { assert, assertEquals } from "jsr:@std/assert";
import {constructSlackMessage} from "../index.ts"

const invokeConstructSlackMessage = async (maxLength: number, prTitle: string, showOwner: boolean, slackmoji?: string) => {
    return await constructSlackMessage(
        {
            GITHUB_TOKEN: "totallyrealgithubtoken",
            GITHUB_REPOSITORY: "pully",
            GITHUB_REPOSITORY_OWNER: "N35N0M",
            platform_methods: {
                getReviewsRequestedForPr: (pullyCache, prNumber) => Promise.resolve([
                    
                ]),
                getPrReviews: (pullyCache, prNumber) => Promise.resolve([{
                    author: {firstName: 'Bob', githubUsername: "reviewer"},
                    time: new Date(0),
                    state: "approved"
                }])
            }
        },
        {
            PULLY_SLACK_CHANNEL: "fakeslackchannelid",
            PULLY_SLACK_TOKEN: "fakeslacktoken",
            max_length_left_hand_side: maxLength,
            PULLY_HIDE_REPOSITORY_OWNER_IN_SLACK_MESSAGE: showOwner
        },
        {known_authors: [
            {
                firstName: "Kris",
                slackMemberId: "12345",
                slackmoji: slackmoji,
                githubUsername: "n35n0m"
            }
        ]},
        {
            githubUsername: "n35n0m",
                            slackmoji: slackmoji,

        },
        prTitle,
        1,
        "open",
        "n35n0m",
        "pully",
        "https://github.com/N35N0M/pully/pull/19",
        12,
        13
    );
}

Deno.test("constructSlackMessage shall truncate messages larger than configured max", async () => {
    const result = await invokeConstructSlackMessage(40, "My suuuuuuuuuuuuuuuuuuuperlongprtiiiiiiitle", false, ":totally-a-slackmoji:");
    console.log(result)
    assertEquals(result, ":github-pr: <https://github.com/N35N0M/pully/pull/19|[n35n0m/pully]> My suuuuuuuuuuuuuuuuuu... | :github-approve: reviewer")
})


Deno.test("constructSlackMessage shall pad messages smaller than configured max", async () => {
    const result = await invokeConstructSlackMessage(45, "My PR", true, ":totally-a-slackmoji:");
    console.log(result)
    assertEquals(result, ":github-pr: <https://github.com/N35N0M/pully/pull/19|[pully]> My PR (#1) (+12/-13) by n35n0m :totally-a-slackmoji:      | :github-approve: reviewer")
})

Deno.test("constructSlackMessage output should align for similar settings, but with varying PR titles (truncate vs pad)", async () => {
    let resultTruncated = await invokeConstructSlackMessage(45, "My suuuuuuuuuuuuuuuuuuuperlongprtiiiiiiitleeeeeeee", false,":totally-a-slackmoji:"); 
    let resultPadded = await invokeConstructSlackMessage(45, "My PR", true, ":totally-a-slackmoji:");

    // Fixup slackmoji renders to just take one char of space in our non-slack environment
    resultPadded = resultPadded.replaceAll(':totally-a-slackmoji:', ':')
    resultTruncated = resultTruncated.replaceAll(':totally-a-slackmoji:', ':')


    console.log(resultTruncated)
    console.log(resultPadded)
    assertEquals(resultTruncated.length, resultPadded.length)
    assertEquals(resultTruncated.indexOf('|', 45), resultPadded.indexOf('|', 45))
})

Deno.test("constructSlackMessage output should align for similar settings, but with varying PR titles (truncate vs pad) and slackmoji vs no slackmoji", async () => {
    let resultTruncated = await invokeConstructSlackMessage(45, "My suuuuuuuuuuuuuuuuuuuperlongprtiiiiiiitleeeeeeee", false, undefined); 
    let resultPadded = await invokeConstructSlackMessage(45, "My PR", true, ":emoji:");

    // Fixup slackmoji renders to just take one char of space in our non-slack environment
    resultPadded = resultPadded.replaceAll(':emoji:', ':')
    resultTruncated = resultTruncated.replaceAll(':emoji:', ':')


    console.log(resultTruncated)
    console.log(resultPadded)
    assertEquals(resultTruncated.length, resultPadded.length)
    assertEquals(resultTruncated.indexOf('|', 45), resultPadded.indexOf('|', 45))
})