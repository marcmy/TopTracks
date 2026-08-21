# Browser-only Apps Script deployment

TopTracks can be deployed to Douglas's standalone Apps Script project entirely through GitHub. No local TopTracks checkout is required.

## Security model

The public repository never stores the Apps Script Script ID or Google OAuth refresh token.

GitHub Actions uses these repository secrets:

- `TOPTRACKS_SCRIPT_ID` — Douglas's standalone Apps Script project ID.
- `CLASPRC_JSON` — the private clasp OAuth credential file produced after Douglas authorizes Google access.

The deploy workflow creates `.clasp.json` only inside the temporary GitHub Actions runner and deletes it automatically when the runner is destroyed.

## One-time authentication from a GitHub Codespace

1. Open this repository on GitHub.
2. Choose **Code > Codespaces > Create codespace on main**.
3. In the Codespace terminal, enable the Apps Script API for Douglas's Google account at `https://script.google.com/home/usersettings` if it is not already enabled.
4. Authenticate clasp using Douglas's dedicated Keepa Google account:

   ```bash
   npx -y @google/clasp@3.3.0 login --no-localhost
   ```

   Open the Google authorization URL shown by clasp, sign in as Douglas, approve access, and complete the terminal prompt.

5. Store the OAuth credential directly as a GitHub Actions secret without printing it:

   ```bash
   gh secret set CLASPRC_JSON < "$HOME/.clasprc.json"
   ```

6. Store the Apps Script project ID as the second GitHub Actions secret:

   ```bash
   gh secret set TOPTRACKS_SCRIPT_ID
   ```

   Paste the Script ID when prompted.

7. Verify the secret names exist:

   ```bash
   gh secret list
   ```

8. Delete the Codespace after setup. The OAuth credential remains encrypted in GitHub Actions secrets.

## Deploy

After both secrets exist:

1. Open **Actions > Deploy Apps Script** in GitHub.
2. Choose **Run workflow** on `main`.
3. The workflow runs `npm test`, shows the clasp file set, then executes:

   ```bash
   npx -y @google/clasp@3.3.0 push --force
   ```

The workflow is manual-only. A merge or push to `main` cannot deploy to Douglas's account by itself.

## Safe TopTracks rollout after the first successful push

Deploying source code does not install the Gmail processor trigger. In the Apps Script editor, use this order:

1. `previewTopTracksHistory(25)` — read-only.
2. Inspect classifications against the real Keepa emails.
3. `backfillTopTracksHistory(25)` — controlled first mutation batch.
4. `installTopTracks()` — provisions/repairs labels and Sheet state and installs the one-minute processor.

Do not commit `.clasprc.json`, `.clasp.json`, OAuth tokens, or Douglas's raw Keepa email exports.
