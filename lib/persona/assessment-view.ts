import type { Capabilities } from "./client.ts";
import type { State } from "./state.ts";

export type GoalStatus = {
  key: "agent" | "user" | "gmail" | "need";
  label: string;
  value: string;
  status: "complete" | "open" | "deferred" | "failed" | "unavailable";
};

export function showGmailAction(state: State, capabilities: Capabilities): boolean {
  if (!capabilities.gmail || !["not_connected", "failed"].includes(state.gmail)) return false;
  const latestAssistant = [...state.messages].reverse().find((message) => message.role === "assistant");
  const invited = latestAssistant && /(?:connect|verify).{0,35}gmail|gmail.{0,35}(?:connect|verify)/i.test(latestAssistant.content);
  return Boolean(invited || state.gmail === "failed");
}

export function onboardingGoals(
  state: State,
  capabilities: Capabilities,
): GoalStatus[] {
  const gmailStatus: GoalStatus["status"] =
    state.gmail === "connected"
      ? "complete"
      : state.gmail === "deferred"
        ? "deferred"
        : state.gmail === "failed"
          ? "failed"
          : !capabilities.gmail
            ? "unavailable"
            : "open";
  const gmailValue =
    state.gmail === "connected"
      ? state.gmailEmail
      : state.gmail === "deferred"
        ? "Skipped for now"
        : state.gmail === "failed"
          ? "Connection failed"
          : state.gmail === "pending"
            ? "Waiting for Google"
            : capabilities.gmail
              ? "Not connected"
              : "Unavailable here";
  return [
    {
      key: "agent",
      label: "Assistant name",
      value: state.agentName || "Not chosen",
      status: state.agentName ? "complete" : "open",
    },
    {
      key: "user",
      label: "Your name",
      value: state.userName || "Not shared",
      status: state.userName ? "complete" : "open",
    },
    { key: "gmail", label: "Gmail", value: gmailValue, status: gmailStatus },
    {
      key: "need",
      label: "What to help with",
      value: state.need || "Still exploring",
      status: state.need ? "complete" : "open",
    },
  ];
}
