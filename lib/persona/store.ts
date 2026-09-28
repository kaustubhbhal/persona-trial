import { env } from "cloudflare:workers";
import { initialState, reduce, type Event, type State } from "./state";
export function setting(key: string): string {
  return String(
    (env as unknown as Record<string, unknown>)[key] || process.env[key] || "",
  );
}
export function database(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Session storage is unavailable. Please retry.");
  return db;
}
export type SessionRow = {
  id: string;
  state: string;
  version: number;
  expires: number;
  oauth_state: string | null;
  oauth_verifier: string | null;
  oauth_expires: number | null;
  credentials: string | null;
};
export async function getSession(
  request: Request,
  create = false,
): Promise<{ row: SessionRow; state: State; cookie?: string }> {
  const id = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)persona_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const row = id
    ? await database()
        .prepare("SELECT * FROM persona_sessions WHERE id = ? AND expires > ?")
        .bind(id, Date.now())
        .first<SessionRow>()
    : null;
  if (row) return { row, state: JSON.parse(row.state) };
  if (!create)
    throw new Error(
      "Your session expired. Refresh to start a new conversation.",
    );
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const newId = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
  const state = initialState();
  const expires = Date.now() + 7 * 86400000;
  await database()
    .prepare("DELETE FROM persona_sessions WHERE expires < ?")
    .bind(Date.now())
    .run();
  await database()
    .prepare(
      "INSERT INTO persona_sessions (id,state,version,expires) VALUES (?,?,?,?)",
    )
    .bind(newId, JSON.stringify(state), 0, expires)
    .run();
  return {
    row: {
      id: newId,
      state: JSON.stringify(state),
      version: 0,
      expires,
      oauth_state: null,
      oauth_verifier: null,
      oauth_expires: null,
      credentials: null,
    },
    state,
    cookie: `persona_session=${newId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
export async function apply(id: string, event: Event): Promise<State> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await database()
      .prepare(
        "SELECT state,version FROM persona_sessions WHERE id=? AND expires>?",
      )
      .bind(id, Date.now())
      .first<{ state: string; version: number }>();
    if (!row) throw new Error("Session expired. Refresh to continue.");
    const state: State = JSON.parse(row.state);
    const next = reduce(state, event);
    if (next === state) return state;
    const result = await database()
      .prepare(
        "UPDATE persona_sessions SET state=?,version=? WHERE id=? AND version=?",
      )
      .bind(JSON.stringify(next), next.version, id, row.version)
      .run();
    if (result.meta.changes === 1) return next;
  }
  throw new Error("Your conversation changed in another tab. Please retry.");
}
export async function lockTurn(id: string, eventId: string): Promise<boolean> {
  const result = await database()
    .prepare(
      "UPDATE persona_sessions SET turn_lock=?,lock_until=? WHERE id=? AND lock_until<?",
    )
    .bind(eventId, Date.now() + 45000, id, Date.now())
    .run();
  return result.meta.changes === 1;
}
export async function unlockTurn(id: string, eventId: string) {
  await database()
    .prepare(
      "UPDATE persona_sessions SET turn_lock=NULL,lock_until=0 WHERE id=? AND turn_lock=?",
    )
    .bind(id, eventId)
    .run();
}
export function json(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin)
    throw new Error("This request must come from the assessment app.");
}
export async function input(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Expected a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 20000) {
      await reader.cancel();
      throw new Error("That message is too long. Try a shorter version.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid request.");
  return value;
}
