# Persona Assessment Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Persona onboarding demo focused, inspectable, resettable, and shareable on Cloudflare Workers.

**Architecture:** Keep vinext, the existing state reducer, D1 sessions, Google OAuth, and Deepgram voice. Replace the permanent third column with contextual Gmail and draft surfaces inside the conversation; add a dedicated Internals view and visible Reset. Deploy the same server routes with a real D1 binding and server-only secrets.

**Tech Stack:** Next.js 16/Vinext, React 19, TypeScript, Cloudflare Workers/D1, Deepgram Agents, Google OAuth, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-28-persona-assessment-refinement-design.md`

## Global Constraints

- This is a throwaway interview assessment of an adaptive onboarding conversation, not a general-purpose assistant.
- Keep the existing Persona green identity and conversational layout.
- Preserve the existing state reducer, Google OAuth flow, and Deepgram integration.
- Keep keyboard access, labels, visible focus, and mobile layout intact.
- Use Better Design's public hierarchy, spacing, typography, and accessibility guidance as a manual review framework; its MCP tools are not connected in this environment, so no automated Better Design review is claimed.
- Use server-side secrets for OpenAI, Deepgram, Google OAuth, and the session key. Do not display or commit secrets.
- Keep the pre-existing `package-lock.json` change separate unless dependency installation makes its modification necessary.

## Review Focus

1. A user names the agent and immediately provides a task: the app offers voice if available, starts helping, and displays the draft without requiring Gmail (Task 1 browser scenario).
2. A user declines Gmail and later changes their mind: Connect Gmail remains reachable and the deferred state is distinct from unavailable (Tasks 1 and 2 browser scenario).
3. Voice fails or is hung up mid-onboarding: the text composer remains usable and Internals reflects the failed or ended call (Task 2 browser scenario).
4. A long need or email address arrives: the Internals panel wraps without clipping at desktop and phone widths (Task 2 browser scenario).
5. Reset runs with a draft and a connected or pending Gmail state: the old session is invalidated and a new initial state appears (Task 2 integration test).

---

### Task 1: Contextual onboarding surfaces and direct copy

**Files:**
- Modify: `app/page.tsx` (workspace constant, header workspace trigger, conversation log, trailing aside)
- Modify: `app/globals.css` (shell grid, workspace rules, responsive rules)
- Modify: `lib/persona/conversation.ts` (rehearsal copy that refers to the old workspace)
- Modify: `README.md` (describe the resulting demo, not a permanent workspace)

**Interfaces:**
- Consumes: `State.artifact`, `State.gmail`, `Capabilities.gmail`, existing `connect()`, `saveArtifact()` and `api("artifact")`.
- Produces: `draftOpen: boolean` sheet state, contextual Gmail action, inline draft summary, two-column shell. Task 2 adds controls to the same header.

- [ ] **Step 1: Record a failing visual baseline.** At 1440px and 390px widths, capture the current page and note the empty third column and hidden workspace trigger. At 390px, tab from the header into the composer and record focus order.
- [ ] **Step 2: Reshape the page.** Remove `<aside className="workspace-panel">` and the always-present workspace sheet. Keep a single draft editor sheet and open it from a result card rendered after the conversation messages only when `state.artifact` exists. Move the existing Gmail status and `connect()` action to a compact contextual card below the messages after the agent is named. Preserve the copy, edit, and save behavior. The gating expression is:

```tsx
const showGmail = Boolean(
  state?.agentName &&
  (state.userName || state.need || state.gmail !== "not_connected"),
);
const [draftOpen, setDraftOpen] = useState(false);
```

- [ ] **Step 3: Update layout styles.** Use two columns on wide screens and the existing stacked mobile layout. Preserve the current green, serif and icon treatment. Remove unused `.workspace-*`, `.paper-symbol`, and mobile workspace rules after moving draft editor styles to `.draft-sheet` and `.draft-card`. Example core rule:

```css
.app-shell { grid-template-columns: minmax(275px, 29%) minmax(0, 1fr); }
.draft-card { border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
@media (max-width: 700px) { .app-shell { display: flex; flex-direction: column; } }
```

- [ ] **Step 4: Tighten copy.** Keep the opening question plain; remove decorative labels and update rehearsal replies in `lib/persona/conversation.ts` that say a draft is "beside" the conversation or in a workspace. Make Gmail language precise: authorization verifies the account for this demo and does not read or send messages. Update `README.md` to match the UI.
- [ ] **Step 5: Verify the task.** In the browser, name the agent and provide a task in one message, confirm the draft card is visible and editable, then defer Gmail and confirm it remains reachable. At 1440px and 390px, inspect spacing, focus visibility, text wrapping and clipping. Run `npm run typecheck` and `npm run lint`.
- [ ] **Step 6: Commit only Task 1 files.** `git add app/page.tsx app/globals.css lib/persona/conversation.ts README.md && git commit -m "Refine Persona onboarding surfaces"`.

### Task 2: Visible Internals and Reset

**Files:**
- Create: `lib/persona/assessment-view.ts` (pure status projection)
- Create: `tests/assessment-view.test.ts` (status edge cases)
- Modify: `app/page.tsx` (text-labeled header buttons and Internals panel)
- Modify: `app/globals.css` (Internals hierarchy, status rows, timeline, responsive header)
- Modify: `tests/integration.mjs` (Reset invalidates old session)

**Interfaces:**
- Consumes: `State` from `lib/persona/state.ts`, `Capabilities` from `lib/persona/client.ts`, existing `reset()` and `nextAction()`.
- Produces: `onboardingGoals(state: State, capabilities: Capabilities): GoalStatus[]`, where `GoalStatus = { key: "agent" | "user" | "gmail" | "need"; label: string; value: string; status: "complete" | "open" | "deferred" | "failed" | "unavailable" }`.

- [ ] **Step 1: Write the failing pure-state test.** Add tests for fresh, deferred Gmail, failed Gmail, connected Gmail, and ended call display. The first test should import the not-yet-created helper and fail:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../lib/persona/state.ts";
import { onboardingGoals } from "../lib/persona/assessment-view.ts";

test("unavailable Gmail is distinct from user deferral", () => {
  const fresh = initialState();
  assert.equal(onboardingGoals(fresh, { ai: true, voice: false, gmail: false })[2].status, "unavailable");
  assert.equal(onboardingGoals({ ...fresh, gmail: "deferred" }, { ai: true, voice: true, gmail: true })[2].status, "deferred");
});
```

- [ ] **Step 2: Run `npm test` and verify the new test fails** because `assessment-view.ts` does not exist.
- [ ] **Step 3: Implement the projection.** Return rows in agent, user, Gmail, need order. Use the confirmed state values, not message inference. Gmail maps `connected` to complete, `deferred` to deferred, `failed` to failed, unconfigured capability to unavailable, and other states to open; pending displays `Connecting…`. Use `state.gmailEmail` only when connected. Let the panel render call status directly from `state.call`, and `nextAction(state, capabilities.voice)` for the next move.

```ts
export type GoalStatus = {
  key: "agent" | "user" | "gmail" | "need";
  label: string;
  value: string;
  status: "complete" | "open" | "deferred" | "failed" | "unavailable";
};
export function onboardingGoals(state: State, capabilities: Capabilities): GoalStatus[] {
  const gmailStatus = state.gmail === "connected" ? "complete"
    : state.gmail === "deferred" ? "deferred"
    : state.gmail === "failed" ? "failed"
    : !capabilities.gmail ? "unavailable" : "open";
  return [
    { key: "agent", label: "Assistant name", value: state.agentName || "Not chosen", status: state.agentName ? "complete" : "open" },
    { key: "user", label: "Your name", value: state.userName || "Not shared", status: state.userName ? "complete" : "open" },
    { key: "gmail", label: "Gmail", value: state.gmail === "connected" ? state.gmailEmail : state.gmail === "pending" ? "Connecting…" : state.gmail, status: gmailStatus },
    { key: "need", label: "What to help with", value: state.need || "Still exploring", status: state.need ? "complete" : "open" },
  ];
}
```

- [ ] **Step 4: Run `npm test`; all pure-state tests pass.** Add a test for failed Gmail and long `need` value projection without truncating the already-bounded state field.
- [ ] **Step 5: Replace the icon-only settings trigger.** Add visible `Internals` and `Reset` controls in the header at every breakpoint. Internals uses four goal rows, a channel summary, `nextAction`, and the last 12 events with timestamps. The Reset button uses the existing `AlertDialog` and `reset()` handler; remove the Reset action from inside Internals. Keep the destructive effect explicit in the confirmation text.
- [ ] **Step 6: Add Reset integration coverage.** In `tests/integration.mjs`, before the `finally` block, save the current cookie, call `send("reset")`, then GET `/api/persona` with that cookie and assert a fresh state (`version === 0`, no artifact, `gmail === "not_connected"`). Ensure `finally` tolerates a session already reset.
- [ ] **Step 7: Run `npm run test:integration` in rehearsal mode, `npm test`, `npm run typecheck`, and `npm run lint`.** Manually verify the five Review Focus cases, including 1440px and 390px screenshots, keyboard focus, and reset while a call is active.
- [ ] **Step 8: Commit only Task 2 files.** `git add lib/persona/assessment-view.ts tests/assessment-view.test.ts app/page.tsx app/globals.css tests/integration.mjs && git commit -m "Expose onboarding internals and reset"`.

### Task 3: Cloudflare Workers deployment and handoff

**Files:**
- Create: `scripts/cloudflare-deploy.mjs` (validate D1 binding and deploy without printing secrets)
- Modify: `package.json` (deployment script)
- Create: `tests/cloudflare-deploy.test.mjs` (dry-run config fixture)
- Modify: `README.md` and `docs/HANDOFF.md` (actual commands, public URL, current credentials/callback status)

**Interfaces:**
- Consumes: built vinext Worker output, Cloudflare D1 binding named `DB`, server-only environment variables read by `setting()` in `lib/persona/store.ts`.
- Produces: a public `*.workers.dev` URL and a verified `/api/persona` response with `{ state, capabilities }`.

- [ ] **Step 1: Check direct Workers build output.** Run `npm run build`, inspect the generated `dist/server/wrangler.json`, and record the expected entrypoint and D1 binding. Run Cloudflare's documented `vinext check` if build output suggests compatibility trouble; do not replace the existing app with a scaffold.
- [ ] **Step 2: Add a deploy script.** The script reads `dist/server/wrangler.json` after `npm run build`, checks for an entrypoint and `DB` D1 binding, replaces the placeholder database ID with `PERSONA_D1_DATABASE_ID`, writes `dist/server/wrangler.persona.json`, and calls the installed Wrangler CLI. `--dry-run` stops before deployment. Use the same directory as the source config so its relative paths remain valid. Add `"deploy:cloudflare": "npm run build && node scripts/cloudflare-deploy.mjs"` to `package.json`. The script body is:

```js
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const source = process.env.PERSONA_WRANGLER_SOURCE || "dist/server/wrangler.json";
const output = process.env.PERSONA_WRANGLER_OUTPUT || "dist/server/wrangler.persona.json";
const id = process.env.PERSONA_D1_DATABASE_ID || "";
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  throw new Error("PERSONA_D1_DATABASE_ID must be a D1 database UUID.");
const config = JSON.parse(readFileSync(source, "utf8"));
if (!config.main) throw new Error("Vinext build did not emit a Worker entrypoint.");
const database = config.d1_databases?.find((item) => item.binding === "DB");
if (!database) throw new Error("Vinext build did not emit the DB binding.");
database.database_id = id;
database.database_name = "persona-assessment";
config.name = "persona-assessment";
writeFileSync(output, JSON.stringify(config, null, 2) + "\n");
if (process.argv.includes("--dry-run")) process.exit(0);
const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const result = spawnSync(process.execPath, [wrangler, "deploy", "--config", output], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
```

- [ ] **Step 3: Test the deploy script without network access.** Create a temporary fixture with `main: "./index.js"` and a `DB` binding, set `PERSONA_WRANGLER_SOURCE`, `PERSONA_WRANGLER_OUTPUT`, and a sample UUID, and spawn the script with `--dry-run`. Assert that the output preserves `main`, binds the sample ID, and has `name: "persona-assessment"`. Repeat with an unset ID and assert a nonzero exit code. Run `node --test tests/cloudflare-deploy.test.mjs`. The test file is:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("deploy config replaces only the D1 binding and requires an ID", () => {
  const root = mkdtempSync(join(tmpdir(), "persona-deploy-"));
  try {
    const fixture = join(root, "wrangler.json");
    const output = join(root, "wrangler.persona.json");
    writeFileSync(fixture, JSON.stringify({
      main: "./index.js",
      d1_databases: [{ binding: "DB", database_name: "old", database_id: "00000000-0000-4000-8000-000000000000" }],
    }));
    const run = (id) => spawnSync(process.execPath, ["scripts/cloudflare-deploy.mjs", "--dry-run"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PERSONA_WRANGLER_SOURCE: fixture,
        PERSONA_WRANGLER_OUTPUT: output,
        PERSONA_D1_DATABASE_ID: id,
      },
    });
    assert.equal(run("00000000-0000-4000-8000-000000000001").status, 0);
    const config = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(config.main, "./index.js");
    assert.equal(config.name, "persona-assessment");
    assert.equal(config.d1_databases[0].database_id, "00000000-0000-4000-8000-000000000001");
    assert.notEqual(run("").status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 4: Verify local production build and checks.** Run `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test`; run the existing HTTP integration suite in rehearsal mode. Keep the earlier unrelated lockfile diff separate.
- [ ] **Step 5: Prepare Cloudflare resources when authenticated.** Run `./node_modules/.bin/wrangler whoami`; if not authenticated, have the user complete `wrangler login`. Run `wrangler d1 create persona-assessment`, retain its returned UUID in local `PERSONA_D1_DATABASE_ID`, and apply `drizzle/0000_amused_sasquatch.sql` with `wrangler d1 execute persona-assessment --remote --file drizzle/0000_amused_sasquatch.sql`. Run `npm run deploy:cloudflare` once to create the Worker. Upload `OPENAI_API_KEY`, `PERSONA_OPENAI_MODEL`, `DEEPGRAM_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `PERSONA_SESSION_SECRET` with `wrangler secret put NAME --config dist/server/wrangler.persona.json`, reading values from ignored `.env.local` without echoing them. Redeploy and capture the actual Workers URL.

- [ ] **Step 6: Update Google callback allowlist and smoke test.** Add the exact `${workerUrl}/api/google/callback` URI to the existing OAuth client without removing Orbit callbacks. GET `${workerUrl}/api/persona` and verify status 200, secure session cookie, and expected capability flags. In a browser, confirm first turn, call offer/fallback, Internals, Reset, and Gmail callback. If Cloudflare login or Google account access blocks this step, report only that exact external action and retain the validated local result.
- [ ] **Step 7: Update docs and commit deployment changes.** Replace stale Sites-only instructions in `README.md` and `docs/HANDOFF.md` with the tested Cloudflare deployment path and current limitations. Stage only Task 3 files, then `git commit -m "Deploy Persona assessment on Cloudflare"`.
