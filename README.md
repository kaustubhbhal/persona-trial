# Persona onboarding assessment

A small, separate demo of conversational onboarding. It tries to learn an assistant name, your name, a useful task, and a connected Gmail account. After the assistant is named, it offers a browser call when Deepgram is available. People can skip, correct themselves, hang up, or start a task immediately; text remains usable throughout.

This is an assessment, not an Orbit account or inbox client. Gmail OAuth verifies the account but this demo does not read message bodies or send mail. The single-column conversation uses the visual language of yourpersona.com. Sent text appears immediately while a reply is pending. A draft appears when the user has given enough context and can be edited or copied. Gmail is an optional header action when configured; it does not interrupt the conversation. **Internals** exposes confirmed facts, channel status, the next action, and recent application events for reviewers. **Reset** clears the session, draft, and stored Google credentials.

## Run locally

Node 22.13+ is required.

```sh
npm ci
cp .env.example .env.local
npm run db:local
npm run dev -- --port 3017
```

Open `http://localhost:3017`. The default `vinext` dev port is 5173; the command above requests 3017 so it matches the Google callback listed below. If that port is occupied, check the terminal for the actual port and add its callback URL to the OAuth client before testing Gmail.

Local secrets live only in ignored `.env.local`. `OPENAI_API_KEY` enables live text replies; without it, a labeled rehearsal path provides starter responses. `DEEPGRAM_API_KEY` enables browser calls only if Deepgram's short-lived token grant succeeds. The key needs permission to grant tokens. `PERSONA_SESSION_SECRET` must contain at least 32 characters for Gmail OAuth. Restart the server after changing environment values.

## Gmail OAuth

The app reuses the Google OAuth web client variable names from Orbit but has its own session and encrypted credential storage. Keep Orbit's existing callbacks. Add these assessment callbacks as needed:

- `http://localhost:3017/api/google/callback`
- `https://persona-assessment.kaustubhsbhal.workers.dev/api/google/callback`

The flow uses session-bound one-time state, PKCE, a 10-minute authorization window, server-side token exchange, a verified `gmail.readonly` grant, Gmail profile verification, and AES-GCM encrypted token storage. Authorization runs in a popup when allowed. Cancelling does not block the task. Reset deletes this app's stored credentials; it does not revoke Google's app-level authorization.

## Cloudflare Workers deployment

The public assessment is [persona-assessment.kaustubhsbhal.workers.dev](https://persona-assessment.kaustubhsbhal.workers.dev). Its dedicated D1 database, schema, and provider settings are deployed. Live AI replies and Deepgram token grants have been verified. Gmail's public Google OAuth callback is entered on the Persona client but still needs to be saved before sign-in can complete.

The production build emits a Worker and a local placeholder D1 binding. `scripts/cloudflare-deploy.mjs` replaces that placeholder with the real ID and deploys the same vinext application. It does not print or embed provider secrets.

1. Sign in with `./node_modules/.bin/wrangler login`.
2. Create a dedicated database with `./node_modules/.bin/wrangler d1 create persona-assessment` and record the returned database UUID.
3. Apply `drizzle/0000_amused_sasquatch.sql` to it with `./node_modules/.bin/wrangler d1 execute persona-assessment --remote --file drizzle/0000_amused_sasquatch.sql`.
4. Set `PERSONA_D1_DATABASE_ID` to the returned UUID in the environment running `npm run deploy:cloudflare`. For this deployment, the ID is `b05a151e-bee6-4e55-ab86-8976087e51b2`.
5. On the deployed Worker, set `OPENAI_API_KEY`, `PERSONA_OPENAI_MODEL`, `DEEPGRAM_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `PERSONA_SESSION_SECRET` as Worker secrets. `DEEPGRAM_VOICE` is optional. Use `wrangler secret put NAME --config dist/server/wrangler.persona.json` for each; enter values without printing them. Wrangler publishes a new Worker version when each secret is set.
6. Add the final Workers callback URL to the Google OAuth client, then verify `/api/persona` and the onboarding in a browser.

The deployment script can be checked without contacting Cloudflare:

```sh
PERSONA_D1_DATABASE_ID=00000000-0000-4000-8000-000000000001 node scripts/cloudflare-deploy.mjs --dry-run
```

A separate owner-private Sites preview is still recorded in `.openai/hosting.json`. The direct Workers deployment is the shareable interview target; neither replaces Orbit's production site.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run test:integration` runs a rehearsal-only HTTP suite against `TEST_URL` (default `http://localhost:3017`) and expects AI capability to be off; it avoids model charges. It covers duplicate and concurrent events, forged Gmail status, cross-session isolation, origin/body validation, OAuth cancellation and replay, and Reset. Unit tests cover onboarding state, task-first steering, name and Gmail deferrals, voice config, and the deployment configuration. Local HTTP smoke testing with live keys should avoid sending unnecessary model turns.

## Main files

- `app/page.tsx`, `app/globals.css`: responsive single-column conversation, optimistic sent messages, optional Gmail sheet, contextual drafts, call controls, Internals, and Reset.
- `lib/persona/state.ts`, `lib/persona/assessment-view.ts`: confirmed facts, transitions, and review status projection.
- `lib/persona/store.ts`, `app/api/persona/route.ts`: HTTP-only D1 session, atomic updates, server API, and reset.
- `lib/persona/conversation.ts`: live text prompt, structured reply, and rehearsal behavior.
- `lib/persona/use-voice.ts`, `voice-config.ts`, `voice-availability.ts`: Deepgram call lifecycle, settings, and capability/token-grant checks.
- `lib/persona/google.ts`: OAuth, account verification, and encrypted credentials.
- `docs/HANDOFF.md`: current deployment state and interview walkthrough.
