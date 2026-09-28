# Persona Assessment Implementation Plan

**Goal:** A runnable, disposable conversational onboarding app with Deepgram voice plumbing and Orbit-derived Gmail authorization.
**Architecture:** Separate Vinext app; shared state machine and persistent D1 sessions; server-only provider credentials.
**Tech Stack:** React, TypeScript, Vinext, Cloudflare D1, Deepgram browser SDK, Google OAuth, OpenAI Responses.
**Spec:** docs/design.md
**Execution:** Native, within the user's explicit autonomous scaffolding authorization. No staged approval handoffs during this pass.

## Constraints
- Keep Orbit source, live sessions and personal data untouched.
- Never expose provider secrets, trust a model's connection claim, or require Gmail to start helping.
- Preserve state through refresh, channel switches and provider errors.

## Tasks
- [x] Define typed state, bounded mutation validation, idempotent event reducer and regression tests in lib/persona/state.ts and tests/state.test.ts.
- [x] Add session schema and D1 compare-and-swap persistence, opaque secure cookie and same-origin JSON API.
- [x] Add a shared conversational prompt, strict model output schema and honest offline rehearsal behavior.
- [x] Implement OAuth start/callback with state, PKCE, encrypted tokens and verified Gmail profile; reuse Orbit environment names.
- [x] Add browser voice SDK with short-lived token endpoint, profile-update tool, transcript persistence, interruption and resource teardown.
- [x] Build responsive conversation UI, editable working artifact, call controls, connection card and diagnostics drawer.
- [x] Generate migration, run regression tests/typecheck/build, inspect local browser flows and prepare the available preview for publication. Publication result is recorded in HANDOFF.md.
- [x] Document setup, remaining credentials/callback registration, known limitations and stress-test script.

## Review focus
1. Duplicate requests cannot append the same turn twice.
2. A stale tab cannot overwrite newer confirmed facts.
3. OAuth is session-bound and does not treat a partial scope grant as connection.
4. Ending a call during microphone permission acquisition still releases devices.
5. A failed model or network request preserves the draft and confirmed state.
