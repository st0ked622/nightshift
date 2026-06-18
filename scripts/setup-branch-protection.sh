#!/usr/bin/env bash
#
# One-time setup of branch protection on `main` for st0ked622/nightshift.
#
# Run by the maintainer once, after the workflows have landed on main:
#
#   ./scripts/setup-branch-protection.sh
#
# Requires the `gh` CLI authenticated with admin rights on the repo.
#
# Policy:
#   - Require a PR before merging (0 required approvals — a solo maintainer can
#     still merge their own PRs; the point is nothing reaches main outside a PR).
#   - Require the `validate` status check to pass.
#   - Strict / up-to-date branches before merging.
#   - enforce_admins: true  (a true no-direct-push policy; release-please only
#     opens PRs and creates tags/releases, so it is unaffected).
#
# Emergency hotfix escape hatch: to allow admins to bypass the PR requirement,
# re-run with enforce_admins set to false, e.g.:
#
#   ENFORCE_ADMINS=false ./scripts/setup-branch-protection.sh
#
set -euo pipefail

REPO="${REPO:-st0ked622/nightshift}"
BRANCH="${BRANCH:-main}"
ENFORCE_ADMINS="${ENFORCE_ADMINS:-true}"

echo "Configuring branch protection on ${REPO}@${BRANCH} (enforce_admins=${ENFORCE_ADMINS})..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["validate"]
  },
  "enforce_admins": ${ENFORCE_ADMINS},
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Done. Current protection summary:"
gh api "repos/${REPO}/branches/${BRANCH}/protection" \
  --jq '{required_status_checks, enforce_admins: .enforce_admins.enabled, required_pull_request_reviews: .required_pull_request_reviews.required_approving_review_count}'
