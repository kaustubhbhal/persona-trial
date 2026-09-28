# Persona assessment

Disposable conversational onboarding, isolated from Orbit. A React/Vinext app with durable D1 sessions, shared voice/text memory, an editable draft workspace, a real Google OAuth implementation, and Deepgram browser voice integration.

## Current status

The UI, session storage, rehearsal conversation, corrections, early task graduation, draft editing, Gmail OAuth start/cancel validation, and missing-voice recovery are working. Deepgram audio and real model conversation still require working credentials. Rehearsal mode is visibly labeled and intentionally limited; it is not a substitute for the conversational stress test.

This app borrows Orbit's Google credential variable names and OAuth/session design. It does not import Orbit's runtime data, personal sessions, inbox, or service databases. Existing Orbit files were not changed.

## Run locally

Node 22.13+ required.

```sh
npm ci
cp .env.example .env.local
npm run db:local
npm run dev -- --port 3017
```

Open http://localhost:3017. Without an OpenAI key, the UI uses a deterministic rehearsal with starter drafts. Set a working `OPENAI_API_KEY` to enable structured live responses. Set `DEEPGRAM_API_KEY` to enable actual browser calls; Deepgram's Voice Agent runs its configured thinking provider. Restart the server after changing environment variables.

Only `.env.local` stores local secrets, and it is ignored. Cloud deployment uses runtime secrets, not source or build-time public values.

## Gmail

Reuse Orbit's existing Google OAuth web client and add these exact authorized redirect URIs in Google Cloud:

- `http://localhost:3017/api/google/callback`
- `https://persona-first-conversation.kaustubhsbhal.chatgpt.site/api/google/callback`

Do not replace Orbit's existing redirect URI. This app computes its own redirect based on the request origin; it intentionally does not use `GOOGLE_OAUTH_REDIRECT_URL`.

The flow uses session-bound one-time state, PKCE, a 10-minute authorization expiry, server-side token exchange, verified `gmail.readonly` grant, Gmail profile verification, and AES-GCM encrypted token storage. Tokens are not returned to the browser. Authorization opens in a separate window; the main call can continue. Cancellation does not block the task.

The assessment currently verifies the Gmail account only. It does not read message bodies, send mail, or refresh expired tokens for ongoing inbox use. Drafts use information the user provides. Restarting an assessment deletes its stored credentials; it does not revoke Google's app-level grant, which may also be used by Orbit.

## Checks

```sh
npm run typecheck
npm run lint
npm test
# Requires the local server and rehearsal mode:
npm run test:integration
npm run build
```

The integration suite creates disposable sessions and checks duplicate requests, concurrent updates, cross-session isolation, forged connection status, cross-origin requests, oversized bodies, refresh persistence, missing voice configuration, OAuth cancellation and replay rejection. It never opens a real inbox or makes a model call.

## Files

- `app/page.tsx`, `app/globals.css`: responsive conversation, call controls, draft workspace and diagnostics drawer.
- `lib/persona/state.ts`: bounded facts, independent setup/task state and idempotent events.
- `lib/persona/store.ts`: opaque HTTP-only sessions, D1 compare-and-swap and turn lease.
- `lib/persona/conversation.ts`: shared prompt, structured response schema and labeled rehearsal.
- `lib/persona/use-voice.ts`, `voice-config.ts`: Deepgram microphone/player lifecycle, interruptions, transcript persistence and shared tools.
- `lib/persona/google.ts`: OAuth and encrypted credential persistence.
- `app/api/persona/route.ts`: same-origin server API.
- `docs/HANDOFF.md`: remaining setup and interview stress-test script.

## Deployment

A separate private Sites project is recorded in `.openai/hosting.json`. D1 migrations are in `drizzle/`. Publish using the Sites workflow; never deploy this app over Orbit's website. Private previews require owner sign-in. Reviewer access needs to be arranged before sharing the interview link.
