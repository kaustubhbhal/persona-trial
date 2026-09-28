import { test } from "node:test";
import assert from "node:assert/strict";
import { initialAgentName, initialUserName, respond, rehearsal } from "../lib/persona/conversation.ts";
import { initialState } from "../lib/persona/state.ts";

test("the first bare name is honored before model generation", async () => {
  const state = initialState();
  assert.equal(initialAgentName(state, "goon"), "goon");
  const proposal = await respond(state, "goon", "", "", false);
  assert.equal(proposal.agentName, "goon");
  assert.equal(proposal.reply, "goon it is. What should I call you?");
});

test("a task or greeting is not mistaken for the assistant's name", () => {
  const state = initialState();
  assert.equal(initialAgentName(state, "help"), null);
  assert.equal(initialAgentName(state, "hello"), null);
  assert.equal(initialAgentName(state, "Help me plan my week"), null);
});

test("rehearsal is honest about a class schedule it cannot read", () => {
  const state = initialState();
  state.agentName = "Jarvis";
  state.userName = "Michael";
  const answer = rehearsal(state, "What classes do I have tomorrow?");
  assert.match(answer.reply || "", /can't see your class schedule/i);
  assert.match(answer.reply || "", /timetable/i);
  assert.equal(answer.artifact, undefined);
});

test("a bare preferred name after the assistant asks is captured without a repeat", async () => {
  const state = initialState();
  state.agentName = "Jarvis";
  state.messages.push({ id: "asked", role: "assistant", channel: "text", at: Date.now(), content: "Jarvis it is. What should I call you?" });
  assert.equal(initialUserName(state, "Michael."), "Michael");
  const answer = await respond(state, "Michael.", "", "", false);
  assert.equal(answer.userName, "Michael");
  assert.doesNotMatch(answer.reply || "", /what should i call you/i);
});

test("tomorrow planning asks for fixed commitments before inventing a plan", () => {
  const state = initialState();
  state.agentName = "Jarvis";
  state.userName = "Michael";
  const answer = rehearsal(state, "Let's plan out my day for tomorrow.");
  assert.match(answer.reply || "", /classes or appointments/i);
  assert.equal(answer.artifact, undefined);
});
