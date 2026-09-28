import { clean, type Proposal, type State } from "./state.ts";

export function declinesAgentName(text: string): boolean {
  return /\b(?:don['’]?t|do not|dont|won['’]?t|rather not|not going to)\b.{0,35}\b(?:name|call)\s+(?:you|yourself)\b|\b(?:you (?:pick|choose)|pick (?:one|for yourself)|up to you|i don['’]?t care|idc)\b/i.test(text);
}

function reminderTask(text: string): string | null {
  const match = text.match(/\bremind me to\s+(.+?)\s+tomorrow\b/i);
  return match ? clean(match[1].replace(/[.!?]+$/, ""), 120) : null;
}

function reminderTime(text: string): string | null {
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (!match) return null;
  return `${Number(match[1])}:${match[2] || "00"} ${match[3].toLowerCase().startsWith("a") ? "AM" : "PM"}`;
}

function askedName(state: State): number {
  return state.messages.filter((message) =>
    message.role === "assistant" && /what should i call you|what(?:'|’)s your name/i.test(message.content),
  ).length;
}

function declinedUserName(state: State, text: string): boolean {
  const messages = [...state.messages, { role: "user", content: text }];
  return messages.some((message, index) => {
    if (message.role !== "user") return false;
    if (/\b(?:don['’]?t|do not|rather not|won['’]?t)\b.{0,30}\b(?:share|tell|give|say)\b.{0,20}\b(?:my )?name\b|\b(?:skip|no)\s+(?:my )?name\b/i.test(message.content)) return true;
    return /^(?:no|skip|pass|rather not)[.!]?$/i.test(message.content.trim()) &&
      index > 0 && /what should i call you|what(?:'|’)s your name/i.test(messages[index - 1].content);
  });
}

function offeredGmail(state: State): boolean {
  return state.messages.some((message) => message.role === "assistant" && /connect gmail|gmail.*(?:verify|connect)/i.test(message.content));
}

export function steerProposal(
  state: State,
  text: string,
  proposal: Proposal,
  { canGmail = false }: { canGmail?: boolean } = {},
): Proposal {
  const next = { ...proposal };
  const lastAssistant = [...state.messages].reverse().find((message) => message.role === "assistant");
  if (lastAssistant && /gmail.*(?:connect|verif)|connect gmail/i.test(lastAssistant.content) && /^(?:no|no thanks|not now|later|skip)[.!]?$/i.test(text.trim())) {
    next.deferGmail = true;
    next.reply = "No problem. Gmail can wait.";
  }
  const task = reminderTask(text);
  if (task && !state.need && !clean(next.need)) next.need = `Reminder: ${task} tomorrow`;
  const namedByPolicy = !state.agentName && !clean(next.agentName) && (declinesAgentName(text) || Boolean(clean(next.need)));
  if (namedByPolicy) next.agentName = "Milo";

  const reminder = (next.need || state.need).match(/^Reminder: (.+) tomorrow$/i);
  const time = reminderTime(text);
  if (reminder && time) {
    const action = reminder[1].replace(/^./, (letter) => letter.toUpperCase());
    next.artifact = { title: "Reminder for tomorrow", body: `${time} tomorrow — ${action}` };
    next.reply = `${time} tomorrow. Open the reminder below and copy it into your phone’s Reminders.`;
  }

  let reply = clean(next.reply, 12000);
  if (!reply) return next;
  if (namedByPolicy && !/\bMilo\b/i.test(reply)) {
    reply = `I’ll go by Milo for now. ${reply}`;
    next.reply = reply;
  }
  const delivered = Boolean(next.artifact || next.need || state.need);
  if (/^(?:stop|goodbye|bye|leave me alone|i(?:'|’)m done|no more)[.!]?$/i.test(text.trim())) return next;
  const missingName = !state.userName && !clean(next.userName);
  if (delivered && missingName && !declinedUserName(state, text) && askedName(state) < 2 && !reply.includes("?"))
    reply = `${reply} What should I call you?`;
  if (delivered && canGmail && state.gmail === "not_connected" && !next.deferGmail && !offeredGmail(state) && !/gmail.{0,35}(?:connect|verif)|connect.{0,35}gmail/i.test(reply))
    reply = `${reply} Gmail is optional here; connecting it verifies your account. The Connect Gmail action is below if you want it.`;
  next.reply = reply;
  return next;
}
