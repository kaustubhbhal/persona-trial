import type { State } from "./state";
export type Capabilities = { ai: boolean; voice: boolean; gmail: boolean };
export async function api<T = { state: State }>(
  action: string,
  values: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch("/api/persona", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, id: crypto.randomUUID(), ...values }),
    signal: AbortSignal.timeout(45000),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error || "That didn’t go through. Please retry.");
  return data;
}
