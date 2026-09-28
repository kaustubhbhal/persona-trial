import { test } from "node:test";
import assert from "node:assert/strict";
import { initialAgentName, respond } from "../lib/persona/conversation.ts";
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
