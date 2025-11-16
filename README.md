- [Pully](#pully)
  - [Getting started](#getting-started)
  - [Core design guidelines](#core-design-guidelines)
  - [Future ideas](#future-ideas)
  - [Ideas tested but not working](#ideas-tested-but-not-working)


# Pully
Get an overview of PR statuses in slack in a high-paced environment.

This is a CI job that constantly updates one minimal slack message in a single channel per PR. 

This is self-contained in the repo, and required no extra running services if you are using Github (and could be easily extended to Gitlab/other Git vendors with a CI platform).

## Getting started
1. Create a dedicated slack channel for pully to post to, note down its channel ID. You can find this by opening the slack channel in your browser. The URL should have format `something.slack.com/client/<clientid>/<channelid>`
2. Generate a slack token with permission to write to this channel, and nothing else preferrably (not read either).
3. Configure your repo's secrets:
    - `PULLY_SLACK_CHANNEL`: The channel id of the channel you made in step 1.
    - `PULLY_SLACK_TOKEN`: The slack token with permission to post to only `PULLY_SLACK_CHANNEL`, that you made in step 2.
4. Create an orphan branch called `pully-persistent-state-do-not-use-for-coding` by running `git checkout --orphan pully-persistent-state-do-not-use-for-coding`, this is where pully will stash its state. 
\
\
It's important that any branch protection rules allows GITHUB_TOKEN to write to this branch. **Note that the state is readable for everyone if this is a public repo.** The info present in the state is:
    - Name of the github repository (if you can reach the repo, you know this already)
    - Pull request numbers in the repository (if you can reach the repo, you know this already)
    - The message timestamp of the original slack message per pr (not considered sensitive. You cant do anything with this timestamp without read/write permission to the slack channel, and you need to know the slack channel)
    - Any provided github usernames
    - (Optional): The first name and the slack ID of github authors. **This will only be part of the state if committed to the state in step 5**
5. (Optional, omitting this will lead to github usernames being posted) Commit the initial `.pully/config.json` to your default branch (main), where you specify optional information about the authors. If you do not wish to share this information, the only effect is that the slack message wont @-mention requested reviewers, and we will use github usernames instead of first names when reporting approvals and change requests. 
```
{
  "known_authors": [
    {
      "githubUsername": "kristoffer-monsen-bulder",
      "slackMemberId": "U08FWFQPT60",
      "firstName": "Kris",
      "slackmoji": ":meepmeep:"
    },
    {
      "githubUsername": "N35N0M",
      "slackMemberId": "U08FWFQPT60",
      "firstName": "Kris",
      "slackmoji": ":meepmeep:"
    }
  ]
}
```
6. Add the pully github action to the `.github/workflows` folder of your repo's main branch. An example is found in this repos self-test, `pully/.github/workflows/pully.yml`. Replace the self-test commit SHA with a github release tag (or its SHA, to guarantee that the content doesnt change): https://github.com/N35N0M/pully/tags
7. Create a new PR, pully.yml should run when you create the PR and post to your slack channel.

## Core design guidelines
- One slack message per unique PR
  - If title changes: Edit the original slack message
  - If title is longer than 100 characters: truncate title in slack message
- Line format: `<branch state emoji> <Repo fullname> <PR title> <PR link displayed as repo/pr-number> (<line diff>) by <author nickname (no @mention)> [| <Approved emoji> [... list of approver firstnames]] [| <Changes requested emoji> [... list of change requester firstnames]] [| <Review requested emoji [... list of reviewers]>]`
    - Why branch state emoji: breaks up text, and gives a quick overview of what is open and closed in a dense list of PR messages.
    - Why repo fullname? Need to know which repo it happens in. Not all reviewers are neccesarily familiar with all repos.
    - Why PR title and link? Need to know what the PR is about, and easily access it.
    - Why linediff? Gives potential reviewers idea of how large the PR is, and how low hanging it is.
    - Why author? Give kudos
    - Why approve list? Make it clear if the PR has been approved, and by who
    - Why change request list? Make it clear that the PR is blocked by requested changes, and by whom it was requested
    - Why list of review requests? Give review requests a slack notification the first time, to make it clear that action is required

- Communicate PR status with strikethrough:
    - Active: no strikethrough
    - Closed/merged: strikethrough, with a reason at the end of line 1.


Assumptions:
- You are ok with having an orphaned branch called "pully-persistent-state-do-not-use-for-coding" in your branch managed by pully.
  - This is to avoid needing external infrastructure in order to get this functionality. Less complexity and less risks.
  - Cache/artifacting in github doesnt work reliably/isnt easy to share accross workflows. An orphan branch is more technology agnostic.

- You have the custom slackmojis (get them from https://slackmojis.com for instance):
  1. :github-approve:
  2. :github-changes-requested:
  3. :github-closed:
  4. :github-merged:
  5. :github-pr:
  6. :code-review:

## Future ideas
See the github issues board: https://github.com/N35N0M/pully/issues

## Ideas tested but not working
- Aligning the sections across messages: unsuccessful because slack doesnt use monospacing, causing alignmentissues.