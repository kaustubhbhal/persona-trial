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
