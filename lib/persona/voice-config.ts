import { prompt } from "./conversation";
import type { State } from "./state";
export const rememberFunction = {
  name: "remember_context",
  description:
    "Persist confirmed user name, useful task, refusals, or a useful draft. Call as soon as facts are learned, before replying. Null means unchanged.",
  client_side: true,
  parameters: {
    type: "object",
    properties: {
      userName: { type: ["string", "null"] },
      need: { type: ["string", "null"] },
      deferGmail: { type: "boolean" },
      artifact: {
        type: ["object", "null"],
        properties: { title: { type: "string" }, body: { type: "string" } },
      },
    },
    required: ["userName", "need", "deferGmail"],
  },
};
export function voiceConfig(state: State, voice: string) {
  return {
    language: "en",
    listen: { provider: { type: "deepgram", model: "nova-3" } },
    think: {
      provider: { type: "open_ai", model: "gpt-4o-mini" },
      prompt: prompt(state, true),
      functions: [rememberFunction],
    },
    speak: {
      provider: { type: "deepgram", model: voice || "aura-2-thalia-en" },
    },
    greeting: state.need
      ? `Hey${state.userName ? ` ${state.userName}` : ""}. Let’s pick up where we left off. What would you like to tackle first?`
      : `Hey${state.userName ? ` ${state.userName}` : ""}, it’s ${state.agentName || "Milo"}. ${state.userName ? "What’s on your plate today?" : "What should I call you?"}`,
  };
}
