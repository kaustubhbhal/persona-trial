import { test } from "node:test";
import assert from "node:assert/strict";
import { voiceConfig } from "../lib/persona/voice-config.ts";
import { initialState } from "../lib/persona/state.ts";

test("voice agent uses a supported client function definition", () => {
  const config = voiceConfig(initialState(), "");
  const functionDefinition = config.think && !Array.isArray(config.think)
    ? config.think.functions?.[0]
    : undefined;
  assert.ok(functionDefinition);
  assert.equal("client_side" in functionDefinition, false);
  assert.equal("endpoint" in functionDefinition, false);
  const params = functionDefinition.parameters as { properties: Record<string, { type: string }> };
  assert.equal(params.properties.userName.type, "string");
  assert.equal(params.properties.need.type, "string");
});

test("voice picks up a reminder without asking for the task again", () => {
  const state = initialState();
  state.agentName = "Milo";
  state.need = "Reminder: eat tomorrow";
  const config = voiceConfig(state, "");
  assert.match(config.greeting || "", /What time tomorrow\?/);
  assert.doesNotMatch(config.greeting || "", /tackle first/i);
});

test("rejoining a call does not replay the original task introduction", () => {
  const state = initialState();
  state.agentName = "Milo";
  state.need = "Plan tomorrow";
  state.call = "ended";
  state.artifact = { title: "Tomorrow", body: "9 AM — Class" };
  const config = voiceConfig(state, "");
  assert.match(config.greeting || "", /pick up where we left off/i);
  assert.doesNotMatch(config.greeting || "", /your draft is here/i);
});
