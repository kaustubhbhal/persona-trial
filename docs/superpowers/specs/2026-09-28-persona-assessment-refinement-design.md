# Persona assessment refinement

## Intent and scope

This is a throwaway interview assessment of an adaptive onboarding conversation, not a general-purpose assistant. The demo should feel natural, show value quickly, collect an agent name, a user name, a Gmail connection, and a concrete need, and attempt to use a browser voice call for everything after the agent name. It must recover from call hangups and other user detours. The assessment should make its product decisions and technical state easy for an interviewer to inspect.

Keep the existing Persona green identity and conversational layout. Refine the current app rather than replace its visual language. The user accepts Cloudflare as the hosting target, so use the existing vinext/Cloudflare runtime instead of migrating the application to Vercel.

## Experience

On wide screens, use the existing dark-green companion area and a wider conversation area. Remove the permanently empty draft column. A generated artifact appears as a compact result card within the conversation, with an explicit action to open and edit the full draft in a sheet. Before a draft exists, there is no placeholder workspace. Gmail connection is a contextual action in the conversation and remains reachable after deferral; it does not occupy a permanent third column.

Show a text-labeled `Internals` button and a visible `Reset` button in the conversation header, including responsive layouts. Reset confirms that it clears this assessment session's conversation, artifact, and Gmail credentials. Internals opens an intentional assessment panel: four onboarding goals with observed values and status, channel status (text, voice, Gmail), the next useful action, and a concise recent-event timeline. It describes application state and events, never hidden model reasoning. The panel distinguishes unavailable capabilities from user deferral and connection errors.

Copy should be direct and specific. Remove ornamental phrases and claims that imply more product functionality than the assessment has. The opening asks for an agent name; after that, the assistant offers a browser call when voice is available. If voice is unavailable or a call ends, it continues naturally in text. Avoid exposing a call invitation when the capability probe fails.

## State and hosting

Keep the current Cloudflare D1 session store because it already supports Gmail OAuth callbacks, call interruptions, idempotent event processing, and concurrency control. Conversation history is not a product feature. The prominent Reset action is the way testers restart, and the UI must not imply a long-term account or saved workspace. Sessions remain short-lived and are cleared on Reset. No new persistence subsystem or account model is added.

Deploy the existing vinext app to a shareable Cloudflare Workers URL with a D1 binding. Use server-side secrets for OpenAI, Deepgram, Google OAuth, and the session key. The Google OAuth client's allowed redirect URI must include the final deployment URL's `/api/google/callback`. Do not display or commit secrets. If Cloudflare authentication or Google Cloud configuration cannot be performed from the current environment, complete code and local validation first, then report the exact external step.

## Implementation boundaries

Preserve the existing state reducer, Google OAuth flow, and Deepgram integration. Change `app/page.tsx` and `app/globals.css` for layout and copy, with only targeted backend changes needed for reset/session expiry or deployment configuration. Remove the right-column workspace trigger once its draft and Gmail actions have contextual homes. Keep keyboard access, labels, visible focus, and mobile layout intact. Use Better Design's public hierarchy, spacing, typography, and accessibility guidance as a manual review framework; its MCP tools are not connected in this environment, so no automated Better Design review is claimed.

## Validation

Run tests, typecheck, lint, and a production build. Manually verify the first turn, agent-name handling, voice offer, a call failure/hangup to text recovery, Gmail connect/deferral, draft result visibility, Internals accuracy, and Reset. Review desktop and narrow-screen screenshots for hierarchy, spacing, clipping, focus states, and empty-state behavior. On deployment, smoke-test the public URL and callback route without exposing credentials.

## Trade-offs

Retaining D1 means a conversation can survive a refresh until Reset or expiry, even though durable conversation history is unnecessary to the assessment. That is acceptable here because changing the state model would risk the OAuth and call-recovery paths without improving the interview demonstration. A direct Cloudflare Workers deployment requires a Cloudflare login and a D1 database in the account; these are not currently authenticated in the local CLI.
