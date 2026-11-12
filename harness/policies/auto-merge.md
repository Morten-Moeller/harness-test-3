# Policy: what may be merged automatically

Automatic merge means: `auto-merge.yml` enables GitHub auto-merge on the pull request, and GitHub
merges it as soon as every required check is green. No agent runs `gh pr merge`.

There are two paths: low risk without a person, medium and high risk after the person's decision
(G2, `human-approval.md`). The conditions under Always hold for both.

## Always

1. **Base is the default branch** of `harness/config.yml`, and the PR is not a draft.
2. **`auto_merge_enabled: true`** in `harness/config.yml` of the base branch.
3. **The base branch has required status checks** (ruleset from `setup-repo.sh`). Without them
   GitHub would merge at once, so the job does not enable auto-merge.
4. **Every required check green**: `gates (test|typecheck|lint|sast|deps|drift|e2e)`, `risk`,
   `review-rules`, `ai-review`, `human-gate`. GitHub enforces this part; the job only enables
   auto-merge. `ai-review` is the commit status of `/review`: green means no blocking findings.

## Low risk

1. **Risk level low**, computed by `harness/scripts/risk-level.sh` inside the job from the files
   of the base branch. The `risk:*` label is not trusted.
2. **Author on the allowlist** in `harness/config.yml` (`auto_merge_allowlist`), or the change is
   documentation only (every file matches a `low` pattern under `docs/` or `*.md`).
3. **Dependabot** PRs: update type `version-update:semver-patch` or `version-update:semver-minor`
   from `dependabot/fetch-metadata`, and no file outside the manifests and lock files. CI sets
   `ai-review` for them without an agent.
4. **No label `needs-human`**. CI sets it when the rule check finds a changed gate.

## Medium and high risk

1. **`human-gate` passed**: the label `human-approved` set by a person after the last push, or an
   approving review of the head commit by another person (`second_reviewer_for`). The label is the
   merge decision; `needs-human` does not block this path, because a person has looked.

## Never automatically

- Medium or high risk without G2.
- A PR whose base is not the default branch.
- A repository without required status checks on the default branch.

## Merge method

Squash merge. The PR title becomes the commit subject, so the title follows
`<type>(<scope>): <summary>` and names the spec id. The branch is deleted after the merge:
`setup-repo.sh` sets `--delete-branch-on-merge` for merges by a person, and
`branch-cleanup.yml` deletes it within an hour after a merge by a bot (decision 0016).

## Audit

Every automatic merge is traceable: the `risk` job summary shows the matched patterns, the
`review-rules` job summary the rule check, the `ai-review` status the review counts, the
`auto-merge` job log the conditions it checked, and the issue events who set the label. A person
reads the merged PRs of the week; `/wochenbericht`-style reports can list them.

## Turning it off

Set `auto_merge_enabled: false` in `harness/config.yml`. The `human-gate` check keeps working; a
person then merges by hand.
