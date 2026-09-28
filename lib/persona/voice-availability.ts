type GrantResult = { access_token?: string };

export async function grantVoiceToken(key: string, timeout = 15000): Promise<string> {
  if (!key) throw new Error("Voice is unavailable right now. Continue in text.");
  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 300 }),
    signal: AbortSignal.timeout(timeout),
  });
  if (response.status === 403)
    throw new Error("Voice setup needs a Deepgram key with Member access.");
  if (response.status === 401)
    throw new Error("The Deepgram key was rejected. Continue in text for now.");
  if (!response.ok)
    throw new Error("Voice is unavailable right now. Continue in text.");
  const data = (await response.json()) as GrantResult;
  if (!data.access_token)
    throw new Error("Voice is unavailable right now. Continue in text.");
  return data.access_token;
}

let checked: { key: string; at: number; available: boolean } | undefined;
export async function voiceAvailable(key: string): Promise<boolean> {
  if (!key) return false;
  if (checked?.key === key && Date.now() - checked.at < 45000)
    return checked.available;
  let available = false;
  try {
    await grantVoiceToken(key, 3500);
    available = true;
  } catch {
    // Voice is optional; a failed readiness check must not block text.
  }
  checked = { key, at: Date.now(), available };
  return available;
}
