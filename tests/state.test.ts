import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, reduce } from "../lib/persona/state.ts";
test("one message can capture all facts and start helping before Gmail", () => {
  const s = reduce(initialState(), {
    id: "a",
    type: "turn",
    text: "Milo, I am Sam, help me draft a follow-up",
    proposal: {
      agentName: "Milo",
      userName: "Sam",
      need: "Recruiter follow-up",
    },
    callAvailable: true,
  });
  assert.equal(s.helping, true);
  assert.equal(s.call, "offered");
  assert.equal(s.gmail, "not_connected");
  assert.equal(s.userName, "Sam");
});
test("naming the assistant does not offer a call when voice is unavailable", () => {
  const s = reduce(initialState(), {
    id: "name",
    type: "turn",
    text: "goon",
    proposal: { agentName: "goon", reply: "goon it is." },
    callAvailable: false,
  });
  assert.equal(s.agentName, "goon");
  assert.equal(s.call, "not_offered");
});
test("correction persists through hangup and duplicate events are no-ops", () => {
  let s = reduce(initialState(), {
    id: "a",
    type: "profile",
    proposal: { agentName: "Milo", userName: "Sam" },
  });
  s = reduce(s, { id: "b", type: "profile", proposal: { userName: "Alex" } });
  s = reduce(s, { id: "c", type: "call", status: "ended" });
  assert.equal(s.userName, "Alex");
  assert.equal(reduce(s, { id: "c", type: "call", status: "active" }), s);
});
test("model cannot set verified Gmail or call success", () => {
  const s = reduce(initialState(), {
    id: "a",
    type: "profile",
    proposal: JSON.parse(
      '{"gmail":"connected","call":"active","gmailEmail":"fake@example.com"}',
    ),
  });
  assert.equal(s.gmail, "not_connected");
  assert.equal(s.gmailEmail, "");
  assert.equal(s.call, "not_offered");
});
test("refusals persist while task and names can arrive out of order", () => {
  let s = reduce(initialState(), {
    id: "a",
    type: "profile",
    proposal: { need: "Plan dinner", declineCall: true, deferGmail: true },
  });
  s = reduce(s, { id: "b", type: "profile", proposal: { agentName: "Milo" } });
  assert.equal(s.helping, true);
  assert.equal(s.call, "declined");
  assert.equal(s.gmail, "deferred");
});
test("connected Gmail cannot be downgraded by a conversational deferral", () => {
  let s = reduce(initialState(), {
    id: "a",
    type: "gmail",
    status: "connected",
    email: "sam@example.com",
  });
  s = reduce(s, { id: "b", type: "profile", proposal: { deferGmail: true } });
  assert.equal(s.gmail, "connected");
});
test("unbounded input is trimmed and empty updates cannot erase confirmed facts", () => {
  let s = reduce(initialState(), {
    id: "a",
    type: "profile",
    proposal: { userName: "Sam", need: "x".repeat(9000) },
  });
  s = reduce(s, { id: "b", type: "profile", proposal: { userName: "  " } });
  assert.equal(s.userName, "Sam");
  assert.equal(s.need.length, 1500);
});

test("short interrupted voice fragments form one visible turn", () => {
  let s = reduce(initialState(), { id: "v1", type: "transcript", role: "user", channel: "voice", text: "Let's" });
  s = reduce(s, { id: "v2", type: "transcript", role: "user", channel: "voice", text: "plan my day tomorrow." });
  assert.equal(s.messages.at(-1)?.content, "Let's plan my day tomorrow.");
  assert.equal(s.messages.filter((message) => message.role === "user").length, 1);
  assert.equal(s.version, 2);
});
