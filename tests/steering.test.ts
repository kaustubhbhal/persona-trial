import { test } from "node:test";
import assert from "node:assert/strict";
import { respond } from "../lib/persona/conversation.ts";
import { initialState, reduce } from "../lib/persona/state.ts";
import { steerProposal } from "../lib/persona/steering.ts";

test("a naming refusal becomes a chosen name, not a dropped onboarding goal", async () => {
  const response = await respond(initialState(), "I don't want to name you", "", "", false, false);
  assert.equal(response.agentName, "Milo");
  assert.match(response.reply || "", /I’ll go by Milo/);
  assert.match(response.reply || "", /help with first/i);
});

test("the reminder exchange delivers value and then asks for the missing preferred name", async () => {
  let state = initialState();
  const turns = ["I don't want to name you", "can you remind me to eat tomorrow", "5pm"];
  let final;
  for (const [index, text] of turns.entries()) {
    final = await respond(state, text, "", "", false, false);
    state = reduce(state, { id: `turn-${index}`, type: "turn", text, proposal: final });
  }
  assert.equal(state.agentName, "Milo");
  assert.match(state.need, /eat tomorrow/i);
  assert.equal(state.artifact?.title, "Reminder for tomorrow");
  assert.match(state.artifact?.body || "", /5:00 PM tomorrow — Eat/);
  assert.match(final?.reply || "", /What should I call you\?/);
  assert.equal((final?.reply || "").match(/\?/g)?.length, 1);
});

test("a task in the naming refusal is handled in the same turn", async () => {
  const response = await respond(initialState(), "I don't want to name you. Can you remind me to eat tomorrow?", "", "", false, false);
  assert.equal(response.agentName, "Milo");
  assert.match(response.need || "", /eat tomorrow/i);
  assert.match(response.reply || "", /What time tomorrow/i);
});

test("after the user provides a name, available Gmail is offered once as optional verification", async () => {
  const state = initialState();
  state.agentName = "Milo";
  state.need = "Reminder: eat tomorrow";
  state.artifact = { title: "Reminder for tomorrow", body: "5:00 PM tomorrow — Eat" };
  state.messages.push({ id: "ask-name", role: "assistant", channel: "text", at: Date.now(), content: "Your reminder is ready. What should I call you?" });
  const response = await respond(state, "Michael.", "", "", false, true);
  assert.equal(response.userName, "Michael");
  assert.match(response.reply || "", /Gmail is optional/i);
  assert.match(response.reply || "", /verifies your account/i);
});

test("a declined preferred name is not asked again after later value", () => {
  const state = initialState();
  state.agentName = "Milo";
  state.need = "Reminder: eat tomorrow";
  state.messages.push({ id: "ask-name", role: "assistant", channel: "text", at: Date.now(), content: "What should I call you?" });
  state.messages.push({ id: "decline", role: "user", channel: "text", at: Date.now(), content: "No." });
  const result = steerProposal(state, "Make another reminder", { reply: "Here it is.", artifact: { title: "Reminder", body: "Tomorrow — Eat" } });
  assert.doesNotMatch(result.reply || "", /What should I call you/i);
});

test("a useful answer without an artifact still returns to a missing onboarding goal", () => {
  const state = initialState();
  state.agentName = "Milo";
  const result = steerProposal(state, "How do I prepare for an interview?", {
    need: "Interview preparation",
    reply: "Start by choosing three examples that show your work and practicing each out loud.",
  });
  assert.match(result.reply || "", /What should I call you\?$/);
});

test("task-first users hear the assistant name instead of seeing a silent rename", () => {
  const result = steerProposal(initialState(), "Help me plan tomorrow", {
    need: "Plan tomorrow",
    reply: "Let's start with your fixed commitments. What time do you need to be somewhere?",
  });
  assert.equal(result.agentName, "Milo");
  assert.match(result.reply || "", /^I’ll go by Milo for now\./);
});

test("a task question still offers Gmail in the same turn without asking a second question", () => {
  const result = steerProposal(initialState(), "Help me plan tomorrow", {
    need: "Plan tomorrow",
    reply: "Let's start with your fixed commitments. What time do you need to be somewhere?",
  }, { canGmail: true });
  assert.match(result.reply || "", /Connect Gmail action is below/);
  assert.equal((result.reply || "").match(/\?/g)?.length, 1);
  const next = reduce(initialState(), { id: "task", type: "turn", text: "Help me plan tomorrow", proposal: result });
  const followUp = steerProposal(next, "I have a class at 9", { reply: "I'll plan around your class." }, { canGmail: true });
  assert.doesNotMatch(followUp.reply || "", /Connect Gmail action is below/);
});

test("a plain skip at the first naming prompt lets the assistant choose", async () => {
  const response = await respond(initialState(), "skip", "", "", false, false);
  assert.equal(response.agentName, "Milo");
  assert.match(response.reply || "", /I’ll go by Milo/);
});

test("a goodbye does not trigger another onboarding question", () => {
  const state = initialState();
  state.agentName = "Milo";
  state.need = "Plan tomorrow";
  const result = steerProposal(state, "goodbye", { reply: "See you later." });
  assert.equal(result.reply, "See you later.");
});

test("a plain later after the Gmail offer defers the connection", () => {
  const state = initialState();
  state.agentName = "Milo";
  state.userName = "Michael";
  state.need = "Reminder: eat tomorrow";
  state.messages.push({ id: "gmail-offer", role: "assistant", channel: "text", at: Date.now(), content: "Gmail is optional; connecting it verifies your account. Want to do that now?" });
  const result = steerProposal(state, "later", { reply: "Okay." }, { canGmail: true });
  assert.equal(result.deferGmail, true);
  assert.equal(result.reply, "No problem. Gmail can wait.");
});
