# NightShift CI/CD Pipeline — Design

**Date:** 2026-06-17
**Status:** Approved
**Repo:** `st0ked622/nightshift` (public, personal account)

## Goal

Add a CI/CD pipeline that:

1. **Restricts direct pushes to `main`** — all changes go through pull requests.
2. **Automatically updates the version** when a PR is merged to `main`, derived
   from Conventional Commits, and publishes a GitHub Release with the built zip.

## Context

NightShift is a vanilla Chrome MV3 extension. There is no build system today.
The version lives in `manifest.json` (currently `1.0.0`). Releases are published
as `nightshift-v*.zip` artifacts on the GitHub Releases page, which the README
links to. The project follows Conventional Commits. There are no workflows yet.

## Approach: release-please (Release-PR pattern)

We use [release-please](https://github.com/googleapis/release-please), the de
facto standard for public repos. It watches Conventional Commits on `main` and
maintains a standing **"release" PR** that accumulates the next version bump and
an auto-generated `CHANGELOG.md`. Merging that release PR cuts the GitHub
Release, creates the tag, and triggers the zip upload.

Why this pattern over direct-push-from-CI:

- **Nothing pushes directly to `main`** — not even the bot. The version bump
  itself goes through a PR like everything else, so it is fully compatible with
  "restrict direct pushes to main" and needs no branch-protection bypass
  carve-out.
- The pending release is transparent (a visible PR with a changelog preview).

> **Correction (2026-06-18):** The first end-to-end test showed the original
> "no token at all, default `GITHUB_TOKEN`" plan could not satisfy a **required**
> status check on the release PR. GitHub suppresses workflow runs for pushes made
> by `GITHUB_TOKEN` (recursion prevention), so the `release-please--**` push
> trigger never fired; and the `pull_request` run on an Actions-authored PR is
> held as `action_required` and cannot be auto-approved. The fix is a **GitHub
> App token** (not a PAT): release-please runs with a per-run token minted from a
> small repo-scoped GitHub App via `actions/create-github-app-token`. An
> App-minted token is a distinct identity, so the branch/PR it creates **do**
> trigger workflows and the `validate` check populates normally. Nothing expires
> or needs rotation (the token is minted per run). See the updated component
> descriptions below.

### Version source of truth

We add a minimal `package.json` (needed for ESLint anyway). It carries the
version and release-please uses `release-type: node` to bump it. An `extra-files`
rule syncs the same version into `manifest.json` (`$.version`) on each bump. The
current version `1.0.0` seeds `.release-please-manifest.json`. `package.json` and
`manifest.json` versions stay in lockstep.

## Components

### 1. PR checks — `.github/workflows/ci.yml`

A single job named `validate`.

**Triggers:**
- `pull_request` targeting `main`.

Because release-please runs under a **GitHub App token** (see component 2), its
release PR is authored by a distinct App identity rather than `GITHUB_TOKEN`, so
the normal `pull_request` trigger fires on it and the `validate` check populates
like any other PR. (The original design used an extra `push` trigger on
`release-please--**` as a workaround for `GITHUB_TOKEN`-authored PRs not
triggering workflows; with the App token that workaround is unnecessary and was
removed to avoid double-running `validate`.)

**Steps:**
1. Checkout.
2. Set up Node, `npm ci`.
3. **ESLint** — `npx eslint .` over `content.js`, `popup.js`.
4. **Manifest validation** — assert `manifest.json` is well-formed JSON, that
   `manifest_version === 3`, and that a `version` string is present.
5. **Syntax gate** — `node --check` on each JS file.

### 2. Release — `.github/workflows/release-please.yml`

**Trigger:** `push` to `main`.
**Permissions (`GITHUB_TOKEN`):** `contents: write` (checkout + asset upload).
**Token (release-please + asset upload):** a GitHub App installation token minted
per run by `actions/create-github-app-token` from `secrets.RP_APP_ID` and
`secrets.RP_APP_KEY`. The App is repo-scoped with **Contents: Read and write** and
**Pull requests: Read and write**. Not a PAT — no expiry, no rotation.

**Job `release-please`:**
0. `actions/create-github-app-token@v1` mints the App token used by the steps below.
1. `googleapis/release-please-action@v4` (with `token:` set to the App token, reads
   `release-please-config.json` and
   `.release-please-manifest.json`). On normal commit pushes it creates/updates
   the release PR. On the push that lands a merged release PR, it creates the
   GitHub Release and tag, and emits outputs (`release_created`, `tag_name`).
2. If `release_created` is true, the remaining steps run:
   - Checkout.
   - Build `nightshift-${tag_name}.zip` containing **only runtime files**:
     `manifest.json`, `content.js`, `popup.html`, `popup.js`, `icons/`.
     (Excludes `.github/`, `.claude/`, `docs/`, `node_modules/`, `package.json`,
     `eslint.config.js`, `scripts/`, release-please config, README.)
   - `gh release upload "${tag_name}" "nightshift-${tag_name}.zip"`.

Tag format is `vX.Y.Z` (release-please default for `release-type: node`), so the
asset name matches the existing `nightshift-v*.zip` convention in the README.

### 3. Guard — `.github/workflows/guard-main.yml`

**Trigger:** `push` to `main`.

A cheap backstop. It looks up whether the head commit is associated with a
merged PR (via the commits→pulls API). If the commit is **not** associated with
any PR, the run fails and opens an issue flagging a suspicious direct push.

With branch protection enabled this can never fire — it is insurance for the case
where protection is accidentally disabled or misconfigured. Legitimate PR merges
(including release-please's release PR) are associated with a PR and pass.

### 4. Branch protection — `scripts/setup-branch-protection.sh`

A `gh` CLI script run **once** by the maintainer. It configures protection on
`main`:

- Require a pull request before merging, with
  `required_approving_review_count: 0` (a solo maintainer can still merge their
  own PRs; the point is that nothing reaches `main` outside a PR).
- Require the `validate` status check to pass.
- Strict / up-to-date branches before merging.
- `enforce_admins: true` for a true no-direct-push policy. release-please never
  pushes to `main` (it only opens PRs and creates tags/releases), so admin
  enforcement breaks nothing.
- The script documents how to set `enforce_admins: false` if an emergency
  hotfix escape hatch is desired.

## Files

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | PR + release-branch validation (ESLint, manifest, syntax) |
| `.github/workflows/release-please.yml` | release-please + zip build/upload |
| `.github/workflows/guard-main.yml` | Backstop against direct pushes to main |
| `release-please-config.json` | release-please config (`release-type: node`, manifest sync) |
| `.release-please-manifest.json` | Tracks current version (`1.0.0`) |
| `package.json` | Version source + ESLint devDependency + `lint` script |
| `eslint.config.js` | Flat ESLint config (browser + webextension globals) |
| `scripts/setup-branch-protection.sh` | One-time `gh` protection setup |

release-please auto-creates and maintains `CHANGELOG.md`.

## One-time manual steps (documented, not automated)

1. **Create the release-bot GitHub App** (owner: your account):
   - Permissions: **Contents: Read and write**, **Pull requests: Read and write**.
   - No webhook needed. Generate a **private key** (`.pem`).
   - **Install** the App on the `nightshift` repo.
   - Add two repo secrets: `RP_APP_ID` (the App's numeric ID) and `RP_APP_KEY`
     (the full `.pem` contents).
2. Run `scripts/setup-branch-protection.sh`.
3. (Optional / no longer required) "Allow GitHub Actions to create and approve
   pull requests" in **Settings → Actions → General**. With the App token,
   release-please no longer relies on `GITHUB_TOKEN` to open its PR, so this
   setting is not needed — harmless if left enabled.

## Data flow

```
feat/fix commit on a branch
  └─ open PR ──> ci.yml `validate` runs ──> merge PR to main
                                              │
                              push to main ──> release-please.yml
                                              │  (updates the standing release PR
                                              │   with bumped version + CHANGELOG)
                                              ▼
                              merge the release PR ──> push to main
                                              │
                              release-please.yml ──> creates Release + tag vX.Y.Z
                                              │       (release_created = true)
                                              ▼
                              build nightshift-vX.Y.Z.zip ──> upload to Release
```

## Edge cases

- **Loop prevention:** release-please commits/PRs are created with
  `GITHUB_TOKEN`, whose pushes do not re-trigger `pull_request` workflows; the
  release job is idempotent and only cuts a release when a release PR is merged.
- **Release PR check stuck pending:** solved by the `release-please--**` push
  trigger on `ci.yml` so the required `validate` check populates.
- **No Conventional Commit in a PR:** release-please treats it as no release
  (or patch, per config). No version change is forced.
- **First run:** `.release-please-manifest.json` seeded at `1.0.0` so the first
  bump is computed from existing tags/commits correctly.

## Out of scope (YAGNI)

- Publishing to the Chrome Web Store (manual for now).
- Multi-package / monorepo configuration.
- Signing or notarizing artifacts.
