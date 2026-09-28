# Persona assessment handoff

## Current state

The onboarding demo is separate from Orbit. Its single-column conversation takes visual cues from yourpersona.com: black type, generous white space, rounded message bubbles, and a restrained green accent. Gmail lives in an optional header sheet when configured; drafts appear in the conversation when useful. Internals is labeled in the header and shows four onboarding goals, channel status, the next useful move, and recent state events. Reset is also in the header and deletes the assessment session, draft, and stored Gmail credentials.

Text, voice, Google OAuth, and D1 use the existing integration paths. A small server-side steering policy chooses Milo after a naming refusal, prioritizes the user’s request, asks for the missing preferred name after a useful step, and offers Gmail verification once when it is available. The live model still supplies the conversational response; the policy keeps the assessment goals from disappearing after a detour. The Deepgram settings were checked against a live connection response after removing an unsupported client function field. Local credentials are present and `/api/persona` reports text, voice, and Gmail configured. A successful Gmail login with a real account and a full microphone conversation still need end-to-end interview testing. The production build completes.

## Public deployment and remaining setup

The public Worker is [persona-assessment.kaustubhsbhal.workers.dev](https://persona-assessment.kaustubhsbhal.workers.dev). Wrangler is authenticated, the dedicated D1 database (`b05a151e-bee6-4e55-ab86-8976087e51b2`) has the schema, and the app is deployed. Public text onboarding, immediate sent-message rendering, the naming-refusal/reminder/name-steering path, the Jarvis/Michael/tomorrow/classes path, Internals, and Reset were exercised at desktop and 390 px mobile widths. `/api/persona` returns a fresh session and currently reports `ai: false`, `voice: false`, and `gmail: false`.

The remaining account setup is to upload the existing local provider credentials as Cloudflare Worker secrets and save `https://persona-assessment.kaustubhsbhal.workers.dev/api/google/callback` on the Persona OAuth web client in the Orbit Google Cloud project. The current Google client has only the localhost callback. The local `.env.local` values must stay ignored and server-side. Automatic approval review rejected exporting them to Cloudflare, so this step requires explicit user authorization or manual entry. The public flow stays in labeled rehearsal mode until then. The separate owner-private `chatgpt.site` preview is not the reviewer link.

## Interview walkthrough

1. Give the assistant an unusual name or ask it to choose. The name should be respected.
2. Accept the browser call; give your name and task in one sentence, then correct your name.
3. Hang up and continue in text. The confirmed facts should survive.
4. Skip Gmail, then use the header Gmail action later once the Worker secrets and callback are configured. Cancel once, then connect if the account is available.
5. Start a practical task before completing every onboarding field. For tasks with enough context, open the inline draft, edit it, and copy it.
6. Open Internals to inspect captured facts, channel states, next action, and event history.
7. Reset and confirm the fresh opening state. A refresh alone may restore the short-lived D1 session; Reset is the intended test restart.

## Validation

Thirty unit tests, lint, TypeScript, and the production vinext build pass. A local HTTP check confirms Reset invalidates the old cookie and returns an empty state. The rehearsal-only integration suite passed 11 checks against the public Worker; it requires AI capability to be off so it avoids provider charges. Browser visual checks passed on the deployed Worker at wide and 390 px mobile widths. Public AI, Deepgram call, and Gmail OAuth end-to-end checks remain pending the Worker secrets and callback.
