export type Channel = "text" | "voice";
export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  channel: Channel;
  at: number;
};
export type Artifact = { title: string; body: string };
export type State = {
  version: number;
  agentName: string;
  userName: string;
  need: string;
  gmail: "not_connected" | "deferred" | "pending" | "connected" | "failed";
  gmailEmail: string;
  call: "not_offered" | "offered" | "active" | "ended" | "declined" | "failed";
  helping: boolean;
  messages: Message[];
  artifact: Artifact | null;
  events: { id: string; label: string; at: number }[];
  processed: string[];
};
export type Proposal = {
  agentName?: string | null;
  userName?: string | null;
  need?: string | null;
  deferGmail?: boolean;
  declineCall?: boolean;
  reply?: string;
  artifact?: Artifact | null;
};
export type Event = {
  id: string;
  type: "turn" | "profile" | "transcript" | "call" | "gmail" | "artifact";
  text?: string;
  role?: "user" | "assistant";
  channel?: Channel;
  proposal?: Proposal;
  status?: string;
  email?: string;
  artifact?: Artifact;
  callAvailable?: boolean;
};
export function initialState(): State {
  return {
    version: 0,
    agentName: "",
    userName: "",
    need: "",
    gmail: "not_connected",
    gmailEmail: "",
    call: "not_offered",
    helping: false,
    artifact: null,
    processed: [],
    events: [],
    messages: [
      {
        id: "hello",
        role: "assistant",
        content:
          "Hi. What should I call myself? You can pick a name or ask me to choose.",
        channel: "text",
        at: Date.now(),
      },
    ],
  };
}
export function clean(value: unknown, max = 120): string {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
        .trim()
        .slice(0, max)
    : "";
}
export function reduce(s: State, event: Event): State {
  if (!event.id || s.processed.includes(event.id)) return s;
  const next = structuredClone(s);
  const at = Date.now();
  const add = (role: Message["role"], content: string, suffix: string) => {
    const previous = next.messages.at(-1);
    if (event.type === "transcript" && content && previous?.channel === "voice" && previous.role === role && at - previous.at < 8_000 && (role === "assistant" || (previous.content.length < 48 && !/[.!?]$/.test(previous.content)))) {
      previous.content = `${previous.content} ${content}`;
      previous.at = at;
      return;
    }
    if (content)
      next.messages.push({
        id: `${event.id}:${suffix}`,
        role,
        content: clean(content, 12000),
        channel: event.channel ?? "text",
        at,
      });
  };
  const p = event.proposal ?? {};
  if (event.type === "turn" || event.type === "profile") {
    for (const key of ["agentName", "userName", "need"] as const) {
      const value = clean(p[key], key === "need" ? 1500 : 80);
      if (value) next[key] = value;
    }
    if (p.deferGmail && next.gmail !== "connected") next.gmail = "deferred";
    if (p.declineCall && next.call !== "active") next.call = "declined";
    if (next.agentName && next.call === "not_offered" && event.callAvailable)
      next.call = "offered";
    if (p.artifact && clean(p.artifact.body, 12000))
      next.artifact = {
        title: clean(p.artifact.title),
        body: clean(p.artifact.body, 12000),
      };
    if (event.type === "turn") {
      add("user", clean(event.text, 6000), "user");
      add("assistant", clean(p.reply, 12000), "assistant");
    }
  }
  if (event.type === "transcript")
    add(event.role ?? "user", clean(event.text, 6000), "voice");
  if (
    event.type === "call" &&
    ["offered", "active", "ended", "declined", "failed"].includes(
      event.status ?? "",
    )
  )
    next.call = event.status as State["call"];
  // Only server-verified OAuth code is allowed to emit gmail events.
  if (
    event.type === "gmail" &&
    ["pending", "connected", "failed", "deferred", "not_connected"].includes(
      event.status ?? "",
    )
  ) {
    next.gmail = event.status as State["gmail"];
    next.gmailEmail = next.gmail === "connected" ? clean(event.email, 254) : "";
  }
  if (event.type === "artifact" && event.artifact)
    next.artifact = {
      title: clean(event.artifact.title),
      body: clean(event.artifact.body, 12000),
    };
  next.helping = Boolean(next.need);
  next.version += 1;
  next.processed = [...next.processed, event.id].slice(-600);
  next.events = [
    ...next.events,
    {
      id: event.id,
      label: `${event.type}${event.status ? `: ${event.status}` : ""}`,
      at,
    },
  ].slice(-80);
  next.messages = next.messages.slice(-120);
  return next;
}
export function nextAction(s: State, callAvailable = false, gmailAvailable = false): string {
  if (!s.agentName) return "Let the user choose an assistant name, or choose Milo for them";
  if (s.need) {
    if (!s.userName) return "Help with the task, then learn what to call the user when it fits";
    if (gmailAvailable && s.gmail === "not_connected" && !s.messages.some((message) => message.role === "assistant" && /connect gmail|gmail.*(?:verify|connect)/i.test(message.content)))
      return "Offer optional Gmail verification after a useful step";
    return "Keep helping with the task";
  }
  if (callAvailable && s.call === "offered") return "Offer a short browser call; text stays available";
  if (!s.userName) return "Find one useful task, then learn the user's preferred name";
  return "Find one useful task to help with";
}
