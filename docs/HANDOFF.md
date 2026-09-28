# Persona assessment handoff

## Current state

The onboarding demo is separate from Orbit. Its single-column conversation takes visual cues from yourpersona.com: black type, generous white space, rounded message bubbles, and a restrained green accent. Starting a browser call opens a focused call screen with listening/speaking status, captions, and prominent controls; ending it returns to the same conversation. When the assistant offers Gmail, Connect Gmail and Not now appear beside the conversation rather than only in the optional header sheet. Drafts appear in the conversation when useful. Internals is labeled in the header and shows four onboarding goals, channel status, the next useful move, and recent state events. Reset is also in the header and deletes the assessment session, draft, and stored Gmail credentials.

Text, voice, Google OAuth, and D1 use the existing integration paths. A small server-side steering policy chooses Milo after a naming refusal, prioritizes the user’s request, asks for the missing preferred name after a useful step, and offers Gmail verification once when it is available. The live model still supplies the conversational response; the policy keeps the assessment goals from disappearing after a detour. The Deepgram settings were checked against a live connection response after removing an unsupported client function field. Local credentials are present and `/api/persona` reports text, voice, and Gmail configured. A successful Gmail login with a real account and a full microphone conversation still need end-to-end interview testing. The production build completes.

## Public deployment and remaining setup

The public Worker is [persona-assessment.kaustubhsbhal.workers.dev](https://persona-assessment.kaustubhsbhal.workers.dev). Wrangler is authenticated, the dedicated D1 database (`b05a151e-bee6-4e55-ab86-8976087e51b2`) has the schema, and the app is deployed. Public text onboarding, immediate sent-message rendering, the naming-refusal/reminder/name-steering path, the Jarvis/Michael/tomorrow/classes path, Internals, and Reset were exercised at desktop and 390 px mobile widths. `/api/persona` currently reports `ai: true`, `voice: true`, and `gmail: true`.

The Worker has the approved OpenAI, Deepgram, Google OAuth, session, and model settings as secrets. The remaining account setup is to save `https://persona-assessment.kaustubhsbhal.workers.dev/api/google/callback` on the Persona OAuth web client in the Orbit Google Cloud project. It is entered in the form, pending the user’s action-time confirmation. The current saved client has only the localhost callback. The local `.env.local` values remain ignored and server-side. The separate owner-private `chatgpt.site` preview is not the reviewer link.

## Interview walkthrough

1. Give the assistant an unusual name or ask it to choose. The name should be respected.
2. Accept the browser call; give your name and task in one sentence, then correct your name.
3. Hang up and continue in text. The confirmed facts should survive.
4. After the assistant offers Gmail, use the inline Connect Gmail or Not now action. The header sheet remains a later retry path. Once the public callback is saved, cancel once, then connect if the account is available.
5. Start a practical task before completing every onboarding field. For tasks with enough context, open the inline draft, edit it, and copy it.
6. Open Internals to inspect captured facts, channel states, next action, and event history.
7. Reset and confirm the fresh opening state. A refresh alone may restore the short-lived D1 session; Reset is the intended test restart.

## Validation

Thirty-one unit tests, lint, TypeScript, and the production vinext build pass. A local HTTP check confirms Reset invalidates the old cookie and returns an empty state. The rehearsal-only integration suite passed 11 checks before the secrets were added; it requires AI capability to be off so it avoids provider charges. A public AI turn responded, a Deepgram call token was granted, and the focused call screen plus inline Gmail action were checked in the browser. A full microphone conversation and Gmail OAuth sign-in remain to be tested; Gmail needs the callback saved first.
