# What needs you next

1. **Deepgram key:** add a working `DEEPGRAM_API_KEY` as a runtime secret and to local `.env.local`. No key was present in Orbit. The integration is compiled against `@deepgram/agents` 0.1.2, but actual microphone/audio, barge-in, model function calls, latency and provider behavior have not been live-tested.
2. **Text model key:** Orbit's copied local OpenAI key returned HTTP 401 `invalid_api_key` in a minimal provider check. It was removed from this app's local config, was not deployed, and Orbit's original file was left untouched. Add a valid key to enable live conversation. Hosted and local previews currently show limited rehearsal mode.
3. **Google callback:** add the local and hosted callback URLs from README to the existing Orbit OAuth client. This avoids changing Orbit's callback. Google credentials and the new assessment-specific encryption secret are configured privately. Live token exchange with an actual account still needs testing. If Google's app remains in testing, ensure the interviewer account can authorize it.
4. **Reviewer access:** the hosted preview is owner-private. Decide how the interviewer should access it before sending a link. Keep this separate from Orbit's production permissions.

## Scope boundaries

This is a scaffold with a complete rehearsal UI and real provider integration code. It is not yet a fully live interview submission. Gmail connection means verified authorization and account profile, not inbox retrieval. No email is sent. The rehearsal uses deterministic starter drafts; it cannot handle arbitrary natural language like the live model is intended to.

There is no microphone recording stored. Text transcripts and confirmed facts persist in the assessment's own D1 session for seven days; expired rows are cleaned when new sessions are created. Function-tool persistence depends on Deepgram delivering the tool event; hanging up before the provider emits a completed transcript/tool cannot preserve unsent speech. A live call intentionally falls back to text on network loss rather than silently redialing.

## Interview walkthrough

1. Choose Milo or give the agent an unusual name.
2. Accept the browser call. Interrupt it while it is speaking.
3. Give your name and task in a single sentence.
4. Correct your name and change the task mid-conversation.
5. Hang up while the agent responds; continue in text.
6. Open Gmail authorization and cancel it. Continue the task.
7. Connect Gmail successfully, verifying the displayed account.
8. Refresh the page. Confirm the conversation, facts and draft survive.
9. Open session details to inspect what was captured and the application events.
10. Edit and save the draft, then refresh again.

## Engineering notes for the next pass

- Live-test the Deepgram settings/models and function argument schema with a key, then add a provider-backed interruption/reconnect drill.
- Validate actual model behavior against out-of-order answers, vague refusals, jokes, multiple names, prompt injection, and early graduation. State invariants already have automated checks; conversation quality needs live evaluation.
- The private assessment has bounded per-session text turns and request sizes. Add deployment-level rate limits before making a public, unmetered API-key-backed demo.
- Browser refresh drops a live WebSocket by design; the user resumes text or explicitly starts another call. Durable facts survive.
- A single session is intended for one active conversation. Concurrent state updates use compare-and-swap; text turns use a lease and duplicate request IDs. This is not an account system across devices.

## Validation completed

- TypeScript check, ESLint and production build passed.
- Six state regression tests and 14 local HTTP integration checks passed.
- Browser checks covered agent naming, missing-voice fallback, early draft creation, name correction, reload persistence, a 390px mobile layout, workspace opening and draft saving.
- Real Deepgram audio and successful Google account authorization remain untested without the setup above.
