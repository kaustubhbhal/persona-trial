import { prompt } from "./conversation.ts";
import type { AgentSettingsObject } from "@deepgram/agents";
import type { State } from "./state.ts";
export const rememberFunction = {
  name: "remember_context",
  description:
    "Persist confirmed user name, useful task, refusals, or a useful draft. Call as soon as facts are learned, before replying. Null means unchanged.",
  parameters: {
    type: "object",
    properties: {
      userName: { type: "string", description: "The user's preferred name, if shared." },
      need: { type: "string", description: "What the user wants help with, if shared." },
      deferGmail: { type: "boolean" },
      artifact: {
        type: "object",
        properties: { title: { type: "string" }, body: { type: "string" } },
        required: ["title", "body"],
      },
    },
  },
};
export function voiceConfig(state: State, voice: string): AgentSettingsObject {
  return {
    listen: { provider: { type: "deepgram", version: "v1", model: "nova-3", language: "en" } },
    think: {
      provider: { type: "open_ai", model: "gpt-4o-mini" },
      prompt: prompt(state, true),
      functions: [rememberFunction],
    },
    speak: {
      provider: { type: "deepgram", version: "v1", model: voice || "aura-2-thalia-en" },
    },
    greeting: state.need
      ? `Hey${state.userName ? ` ${state.userName}` : ""}. Let’s pick up where we left off. What would you like to tackle first?`
      : `Hey${state.userName ? ` ${state.userName}` : ""}, it’s ${state.agentName || "Milo"}. ${state.userName ? "What’s on your plate today?" : "What should I call you?"}`,
  };
}
