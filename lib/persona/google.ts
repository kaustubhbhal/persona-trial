import { apply, database, setting, type SessionRow } from "./store";
function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
async function sealingKey() {
  const secret = setting("PERSONA_SESSION_SECRET");
  if (secret.length < 32)
    throw new Error(
      "Gmail connection needs a session encryption key. Text is ready to use.",
    );
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
}
export function googleConfigured() {
  return Boolean(
    setting("GOOGLE_OAUTH_CLIENT_ID") &&
    setting("GOOGLE_OAUTH_CLIENT_SECRET") &&
    setting("PERSONA_SESSION_SECRET").length >= 32,
  );
}
export async function startGoogle(request: Request, row: SessionRow) {
  if (!googleConfigured())
    throw new Error(
      "Gmail connection is not configured yet. You can keep going without it.",
    );
  const state = b64(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = b64(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  await database()
    .prepare(
      "UPDATE persona_sessions SET oauth_state=?,oauth_verifier=?,oauth_expires=? WHERE id=?",
    )
    .bind(state, verifier, Date.now() + 600000, row.id)
    .run();
  await apply(row.id, {
    id: crypto.randomUUID(),
    type: "gmail",
    status: "pending",
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: setting("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: new URL("/api/google/callback", request.url).href,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  }).toString();
  return url.href;
}
export async function finishGoogle(request: Request, row: SessionRow) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  if (
    !state ||
    state !== row.oauth_state ||
    !row.oauth_expires ||
    row.oauth_expires < Date.now()
  )
    throw new Error(
      "That connection link expired. Please try connecting again.",
    );
  const claimed = await database()
    .prepare(
      "UPDATE persona_sessions SET oauth_state=NULL,oauth_verifier=NULL,oauth_expires=NULL WHERE id=? AND oauth_state=?",
    )
    .bind(row.id, state)
    .run();
  if (claimed.meta.changes !== 1)
    throw new Error("This connection link was already used. Please try again.");
  if (url.searchParams.has("error")) {
    await apply(row.id, {
      id: crypto.randomUUID(),
      type: "gmail",
      status: "deferred",
    });
    return "cancelled";
  }
  const code = url.searchParams.get("code");
  if (!code) throw new Error("Google did not return an authorization code.");
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: setting("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: setting("GOOGLE_OAUTH_CLIENT_SECRET"),
        redirect_uri: new URL("/api/google/callback", request.url).href,
        code,
        code_verifier: row.oauth_verifier || "",
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error("Google authorization could not be completed.");
    const tokens = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      expires_in?: number;
    };
    if (
      !tokens.access_token ||
      !tokens.scope
        ?.split(" ")
        .includes("https://www.googleapis.com/auth/gmail.readonly")
    )
      throw new Error("Gmail read access was not granted.");
    const profile = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!profile.ok) throw new Error("Could not verify the Gmail account.");
    const { emailAddress } = (await profile.json()) as {
      emailAddress?: string;
    };
    if (!emailAddress)
      throw new Error("Google did not return an email address.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(row.id) },
      await sealingKey(),
      new TextEncoder().encode(
        JSON.stringify({
          ...tokens,
          expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
        }),
      ),
    );
    await database()
      .prepare("UPDATE persona_sessions SET credentials=? WHERE id=?")
      .bind(
        JSON.stringify({
          iv: b64(iv),
          ciphertext: b64(new Uint8Array(encrypted)),
        }),
        row.id,
      )
      .run();
    await apply(row.id, {
      id: crypto.randomUUID(),
      type: "gmail",
      status: "connected",
      email: emailAddress,
    });
    return "connected";
  } catch (error) {
    await apply(row.id, {
      id: crypto.randomUUID(),
      type: "gmail",
      status: "failed",
    });
    throw error;
  }
}
