# Browser-only Apps Script deployment

TopTracks can be deployed to a standalone Apps Script project entirely through
GitHub. No local TopTracks checkout is required.

## Security model

The public repository never stores the Apps Script Script ID or Google OAuth
refresh token.

GitHub Actions uses these repository secrets:

- `TOPTRACKS_SCRIPT_ID` — the standalone Apps Script project ID;
- `CLASPRC_JSON` — the private clasp OAuth credential used only for source deployment.

The account authorizing clasp is the **deployer account**. It does not need access
to the runtime Gmail mailbox. Gmail/Sheets runtime access is granted separately by
the mailbox owner when they run TopTracks inside Apps Script.

The deploy workflow creates `.clasp.json` only inside the temporary GitHub Actions
runner. It is destroyed with the runner.

## One-time deployment authentication from a GitHub Codespace

1. Open this repository on GitHub.
2. Choose **Code > Codespaces > Create codespace on main**.
3. Ensure the Apps Script API is enabled for the deployer Google account at
   `https://script.google.com/home/usersettings`.
4. Authenticate clasp:

   ```bash
   npx -y @google/clasp@3.3.0 login --no-localhost
   ```

   Open the Google authorization URL shown by clasp, sign in with the deployer
   account, approve access, and complete the terminal prompt.

5. Store the OAuth credential directly as a GitHub Actions secret without printing it:

   ```bash
   gh secret set CLASPRC_JSON < "$HOME/.clasprc.json"
   ```

6. Store the Apps Script project ID as the second GitHub Actions secret:

   ```bash
   gh secret set TOPTRACKS_SCRIPT_ID
   ```

7. Verify only the secret names are visible:

   ```bash
   gh secret list
   ```

8. Delete the Codespace after setup.

Never commit `.clasprc.json`, `.clasp.json`, OAuth tokens, Script IDs, or raw
mailbox exports.

## Deploy

The `Deploy Apps Script` workflow runs on every push to `main` and can also be run
manually with `workflow_dispatch`.

The workflow:

1. checks out the repository;
2. installs the configured current Node runtime;
3. runs `npm test`;
4. writes ephemeral clasp configuration from GitHub secrets;
5. shows the deployment file set;
6. executes:

   ```bash
   npx -y @google/clasp@3.3.0 push --force
   ```

Because tests run before `clasp push`, a failing regression suite prevents broken
source from replacing the live Apps Script code.

## Runtime authorization

Source deployment does **not** grant the deployer access to the runtime mailbox.
The mailbox owner must open the shared Apps Script project in their own Google
account and authorize Gmail/Sheets when prompted.

Installable triggers run as the account that creates them. Therefore the mailbox
owner—not the source deployer—must run the installation function.

## Safe TopTracks rollout after deployment

Use the human-facing controls in `src/Code.gs`:

1. `TOPTRACKS_1_PREVIEW_25()` — read-only validation against real alerts.
2. `TOPTRACKS_2_BACKFILL_100()` — controlled historical mutation batch.
3. `TOPTRACKS_3_INSTALL_AUTOMATION()` — creates the one-minute Gmail processor and Settings edit trigger.
4. Use the spreadsheet `Settings` tab for normal configuration after installation.

`TOPTRACKS_DISABLE_AUTOMATION()` removes TopTracks installable triggers without
removing existing Gmail classifications.
