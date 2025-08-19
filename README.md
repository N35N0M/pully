# pully
A github app that reports PR statuses to a slack channel in a condensed manner. 

This borrows from many similar (paid) implementations, and improves upon the existing github-slack integration by not spamming a wall of text for every event.

Core design guidelines:
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


Future fluff:
- Post a summary every morning of PRs that are still left hanging (With link to the existing slack message to avoid duplicated state?)

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
