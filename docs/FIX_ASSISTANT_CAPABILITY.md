# Fix Assistant Capability

## User Outcome

Fix Assistant turns triaged Vibe findings into a scoped implementation handoff and lets the user verify the result with a comparable re-scan.

## Inputs

- Current scan evidence and audit context
- Finding status: open, planned, or ignored
- Project source: local folder, uploaded ZIP, or GitHub repository
- Connected GitHub account for remote side effects

## Outputs

- Copyable coding-agent prompt queue
- Downloadable Markdown implementation plan
- Suggested fix branch and draft pull-request content
- Optional GitHub fix branch and draft pull request
- Score delta with resolved, remaining, and introduced findings

## Product Rules

- Ignored findings remain visible but are excluded from the implementation plan.
- Work is ordered critical, high, medium, then low.
- GitHub mutations happen only after an explicit user action.
- Branch creation copies the scanned base branch and creates no implementation commits.
- Draft pull-request creation requires changes on the fix branch.
- Scan comparison requires the same project and identical audit context.
- GitHub comparisons may use different branches of the same repository.
- Uploaded projects must be uploaded again to produce new evidence.

## Failure And Recovery

- Invalid or existing branch: preserve the plan, show GitHub's error, and let the user edit the branch name.
- Missing GitHub session: preserve the plan and ask the user to reconnect GitHub.
- Pull request without divergent commits: explain that fixes must be pushed before retrying.
- Failed re-scan: preserve the prior report and expose the normal retry path.
- Incomparable scan: show the new report without a misleading delta.

## Non-Goals

- Editing user code
- Generating or pushing implementation commits
- Automatically merging pull requests
- Claiming security certification
- Treating a copied prompt or created branch as proof that a finding is fixed
