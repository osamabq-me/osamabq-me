# Setting up the profile graphics

This repo draws your profile images itself. Once a day, a GitHub Action reads your public GitHub data, redraws the SVG cards in `assets/`, and commits them. The README shows those files, so nothing depends on an outside stats website.

## One-time setup

1. The repo must be named exactly `osamabq-me` (your username) and be **public**.
2. Upload everything in this folder to the repo, including the hidden `.github` folder. On the repo page, use **Add file → Upload files**, drag in the folder contents, and commit to `main`.
   - Tip: GitHub's web upload may skip the `.github` folder. If it doesn't appear, use **Add file → Create new file**, type `.github/workflows/profile.yml` as the name, and paste in the file's contents.
3. Go to **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, and click **Save**.
4. Go to the **Actions** tab, open **Profile graphics**, and click **Run workflow**. After about a minute, the cards show your real numbers.

## Optional: include private repos in the Languages card

Without this step, Languages counts public repos only. To include private repos:

1. Go to **github.com/settings/personal-access-tokens → Generate new token** (fine-grained).
   - Repository access: **All repositories**
   - Permissions: **Metadata: read-only** only
2. Copy the token. In this repo, go to **Settings → Secrets and variables → Actions → New repository secret**, name it `PROFILE_TOKEN`, and paste the token.

Only language totals are used. Private repo names never appear anywhere.

Tokens expire. When yours does, the Languages card keeps its last version until you create a new token.

## Changing what's shown

Edit `profile.config.json`: name, tagline, focus line, location, the stack groups, and repos or languages to leave out of the Languages card. Saving the file triggers a redraw.

## Why it keeps working

- The images are plain files in this repo, so they always load. They can't be rate-limited the way shared stats services can.
- If an update fails, nothing is overwritten. The last good images stay up, and the run shows a red ✗ in the Actions tab.
- GitHub pauses scheduled workflows in a public repo after 60 days with no activity. The daily image commits count as activity. If it ever pauses anyway, the Actions tab shows a button to re-enable it.

## Preview locally

```
node scripts/render.mjs --sample   # made-up data, for checking the design
GITHUB_TOKEN=... node scripts/render.mjs
```
