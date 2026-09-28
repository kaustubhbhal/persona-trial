# Persona assessment

A disposable, independent app inside Orbit. Build authorization: user asked to scaffold autonomously on 2026-09-28 and flag external blockers later.

## Experience
Agent naming starts in text. Offer a browser voice call after naming; voice attempts to collect the user's name, a useful task, and Gmail authorization. Keep a single conversation across channels, accept corrections and out-of-order answers, and start helping as soon as a task is actionable. Gmail and a completed call are not gates to useful work. Refusals are remembered. No automatic sending of email.

## Architecture
Vinext/React on a separate Sites project. D1 stores opaque-cookie-bound sessions, durable turns, structured facts and artifacts. A versioned compare-and-swap protects concurrent updates; repeated event IDs are idempotent. OpenAI produces validated structured conversation updates. Without credentials, a clearly labeled limited rehearsal mode permits local UI and recovery testing. Deepgram's browser agent uses short-lived tokens minted server-side; microphone and player teardown stop recording and stale audio. Voice function calls update the same server state as text.

Google integration borrows Orbit's Google OAuth variable names and server-side authorization pattern. Use this app's own callback with state, PKCE, session binding, narrow Gmail read scope and encrypted tokens. Do not consume Orbit's live sessions, personal inbox or backend data. A completed token exchange and Gmail profile fetch are required to mark connection successful. Local setup can copy only the needed existing credentials into ignored environment configuration.

## Recovery
Reload restores the server conversation. Hangup never erases confirmed facts. Missing microphone/key/provider shows a recoverable explanation with text available. Gmail cancellation and expiry leave a retryable state. Never claim a connection or action succeeded from a model output. A diagnostics drawer exposes facts and events, not hidden reasoning.

## Validation and handoff
Exercise the reducer's corrections, refusals, order independence, session conflict and untrusted connection claims; compile/typecheck; run browser flows at desktop/mobile sizes. Publish a private preview if available. Flag Deepgram key, Google callback allowlist, public interview access and untested live voice explicitly.
