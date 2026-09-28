import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://localhost:3017";
const initial = await fetch(`${base}/api/persona`);
assert.equal(initial.status, 200);
const cookie = initial.headers.get("set-cookie").split(";")[0];
const session = await initial.json();
assert.equal(
  session.capabilities.ai,
  false,
  "Run this suite in rehearsal mode to avoid provider charges.",
);
let checks = 0;
const send = async (action, values = {}, origin = base) => {
  const response = await fetch(`${base}/api/persona`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, id: crypto.randomUUID(), ...values }),
  });
  return { status: response.status, data: await response.json().catch(() => ({ error: "Rejected by server" })) };
};
try {
  const named = await send("turn", {
    text: "Let’s call you Milo.",
    id: "name-test",
  });
  assert.equal(named.status, 200);
  assert.equal(named.data.state.agentName, "Milo");
  checks++;
  const duplicate = await send("turn", {
    text: "Let’s call you Milo.",
    id: "name-test",
  });
  assert.equal(duplicate.data.state.version, named.data.state.version);
  checks++;
  const task = await send("turn", {
    text: "I'm Sam. I need help drafting a recruiter follow-up.",
  });
  assert.equal(task.data.state.helping, true);
  assert.equal(task.data.state.userName, "Sam");
  assert.ok(task.data.state.artifact);
  checks++;
  const concurrent = await Promise.all([
    send("profile", { proposal: { userName: "Alex" } }),
    send("profile", { proposal: { need: "Prepare for the interview" } }),
  ]);
  assert.ok(concurrent.every((r) => r.status === 200));
  let state = (
    await (
      await fetch(`${base}/api/persona`, { headers: { Cookie: cookie } })
    ).json()
  ).state;
  assert.equal(state.userName, "Alex");
  assert.equal(state.need, "Prepare for the interview");
  checks++;
  const forged = await send("profile", {
    proposal: {
      gmail: "connected",
      gmailEmail: "fake@example.com",
      agentName: "Imposter",
    },
  });
  assert.equal(forged.data.state.gmail, "not_connected");
  assert.equal(forged.data.state.agentName, "Milo");
  checks++;
  await send("call", { status: "active" });
  await send("call", { status: "ended" });
  state = (
    await (
      await fetch(`${base}/api/persona`, { headers: { Cookie: cookie } })
    ).json()
  ).state;
  assert.equal(state.call, "ended");
  assert.equal(state.userName, "Alex");
  checks++;
  const badOrigin = await send(
    "call",
    { status: "active" },
    "https://attacker.example",
  );
  assert.ok([400, 403].includes(badOrigin.status));
  checks++;
  const missingVoice = await send("voice-token");
  assert.equal(missingVoice.status, 503);
  checks++;
  const another = await (await fetch(`${base}/api/persona`)).json();
  assert.equal(another.state.userName, "");
  checks++;
  const oversized = await send("turn", { text: "x".repeat(21000) });
  assert.equal(oversized.status, 400);
  checks++;
  if (session.capabilities.gmail) {
    const start = await send("google");
    assert.equal(start.status, 200);
    const url = new URL(start.data.url);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      `${base}/api/google/callback`,
    );
    assert.equal(
      url.searchParams.get("scope"),
      "https://www.googleapis.com/auth/gmail.readonly",
    );
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    checks++;
    const forgedCallback = await fetch(
      `${base}/api/google/callback?state=wrong&code=fake`,
      { headers: { Cookie: cookie } },
    );
    assert.match(await forgedCallback.text(), /result:'failed'/);
    checks++;
    const cancelled = await fetch(
      `${base}/api/google/callback?state=${encodeURIComponent(url.searchParams.get("state"))}&error=access_denied`,
      { headers: { Cookie: cookie } },
    );
    assert.match(await cancelled.text(), /result:'cancelled'/);
    state = (
      await (
        await fetch(`${base}/api/persona`, { headers: { Cookie: cookie } })
      ).json()
    ).state;
    assert.equal(state.gmail, "deferred");
    checks++;
    const replay = await fetch(
      `${base}/api/google/callback?state=${encodeURIComponent(url.searchParams.get("state"))}&error=access_denied`,
      { headers: { Cookie: cookie } },
    );
    assert.match(await replay.text(), /result:'failed'/);
    checks++;
  }
  const reset = await send("reset");
  assert.equal(reset.status, 200);
  const freshResponse = await fetch(`${base}/api/persona`, {
    headers: { Cookie: cookie },
  });
  assert.equal(freshResponse.status, 200);
  const freshState = (await freshResponse.json()).state;
  assert.equal(freshState.version, 0);
  assert.equal(freshState.artifact, null);
  assert.equal(freshState.gmail, "not_connected");
  checks++;
  console.log(
    `${checks} integration checks passed: retries, atomic updates, forged status, refresh, origin, isolation, voice fallback, OAuth and reset.`,
  );
} finally {
  await send("reset");
}
