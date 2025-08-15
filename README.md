# pully
A github app that reports PR statuses to a slack channel in a condensed manner. 

This borrows from many similar (paid) implementations, and improves upon the existing github-slack integration by not spamming a wall of text for every event.

Core design guidelines:
- One slack message per unique PR
  - If title changes: Edit the original slack message
  - If title is longer than 100 characters: truncate title in slack message
- Line 1 Format: `<Author> <line diff> <PR title> <PR link displayed as repo/pr-number> [(merged|closed)]`
    - Why author? Give kudos
    - Why linediff? Gives potential reviewers idea of how large the PR is, and how low hanging it is.
    - Why PR title: Give idea of what PR is about
    - Why pr link as number? Makes it easier to refer to it in discussions/other contexts
- Line 2 Format: (only if changes requested) `<changes requested emoji> [List of requesters]`
    - Why: Display who has reviewed but requested further action
- Line 3 Format: (only if pr approved) `<approved emoji> [List of approvers]`
    - Why:  Kudos to active reviewers.
- Communicate PR status with strikethrough:
    - Active: no strikethrough
    - Closed/merged: strikethrough, with a reason at the end of line 1.
    - Why no emoji as with other solutions: It takes 1-1.5 lines of extra space, and we are aiming for density. Especially when merged/closed do we wish for the entry to be a oneliner so it's like a nice todo-list


Future fluff:
- Post a summary every morning of PRs that are still left hanging (With link to the existing slack message to avoid duplicated state?)

Assumptions:
- You use the github api with token-based auth
- You have the custom slackmojis (get them from https://slackmojis.com for instance):
  1. :github-approve:
  2. :github-changes-requested:
  3. :github-closed:
  4. :github-merged:
  5. :github-pr:
  6. :code-review:
