"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  Copy,
  FileText,
  LoaderCircle,
  Mail,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api, type Capabilities } from "@/lib/persona/client";
import { nextAction, type State } from "@/lib/persona/state";
import { onboardingGoals } from "@/lib/persona/assessment-view";
import { useVoice } from "@/lib/persona/use-voice";

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities>({
    ai: false,
    voice: false,
    gmail: false,
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [artifactEdit, setArtifactEdit] = useState<string | null>(null);
  const artifactBody = artifactEdit ?? state?.artifact?.body ?? "";
  const artifactDirty = artifactEdit !== null;
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingTurn = useRef<{ id: string; text: string } | null>(null);
  const accept = useCallback(
    (next: State) =>
      setState((previous) =>
        !previous || next.version >= previous.version ? next : previous,
      ),
    [],
  );
  const voice = useVoice(accept, setError, state, capabilities.gmail);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/persona");
      const data = (await response.json()) as {
        state: State;
        capabilities: Capabilities;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Could not load conversation.");
      accept(data.state);
      setCapabilities(data.capabilities);
      setError("");
      return data.state;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load your conversation. Please retry.",
      );
    }
  }, [accept]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .then((current) => {
        const result = new URLSearchParams(window.location.search).get(
          "google",
        );
        if (result) {
          setNotice(
            current?.gmail === "connected"
              ? "Gmail connected. Pick up right where you left off."
              : result === "cancelled"
                ? "No problem. We can keep going without Gmail."
                : "Gmail could not connect. You can retry or keep going in text.",
          );
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
  }, [load]);
  useEffect(() => {
    const onGoogle = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "persona:google"
      )
        return;
      void load().then((current) =>
        setNotice(
          current?.gmail === "connected"
            ? "Gmail connected. We can keep going."
            : event.data.result === "cancelled"
              ? "No problem. We can continue without Gmail."
              : "Gmail could not connect. Please retry when you’re ready.",
        ),
      );
    };
    window.addEventListener("message", onGoogle);
    return () => window.removeEventListener("message", onGoogle);
  }, [load]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state?.messages.length, busy]);
  async function send(value = text) {
    const message = value.trim();
    if (!message || busy) return;
    setError("");
    setBusy(true);
    if (!pendingTurn.current || pendingTurn.current.text !== message)
      pendingTurn.current = { id: crypto.randomUUID(), text: message };
    setOptimistic(pendingTurn.current);
    setText("");
    try {
      if (voice.active) await voice.stop();
      const data = await api("turn", {
        text: message,
        id: pendingTurn.current.id,
      });
      accept(data.state);
      setOptimistic(null);
      pendingTurn.current = null;
    } catch (e) {
      setOptimistic(null);
      setText(message);
      setError(
        e instanceof Error
          ? e.message
          : "That message did not go through. Try again.",
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }
  async function connect() {
    setError("");
    const popup = window.open(
      "about:blank",
      "persona-google",
      "popup,width=520,height=720",
    );
    try {
      const { url } = await api<{ url: string }>("google");
      if (popup) {
        popup.location.href = url;
        setNotice(
          "Finish connecting in the Google window. We can keep talking here.",
        );
      } else {
        if (voice.active) await voice.stop();
        window.location.assign(url);
      }
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : "Could not connect Gmail.");
    }
  }
  async function reset() {
    try {
      if (voice.active) await voice.stop();
      await api<{ ok: boolean }>("reset");
      setState(null);
      setText("");
      setOptimistic(null);
      setArtifactEdit(null);
      setDraftOpen(false);
      setNotice("");
      pendingTurn.current = null;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start over.");
    }
  }
  async function saveArtifact() {
    if (!state?.artifact) return;
    try {
      const data = await api("artifact", {
        artifact: { title: state.artifact.title, body: artifactBody },
      });
      accept(data.state);
      setArtifactEdit(null);
      setNotice("Your draft is saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your draft.");
    }
  }
  const name = state?.agentName || "Assistant";
  const active = voice.active;
  const artifact = state?.artifact;
  const showGmail = Boolean(state?.agentName && capabilities.gmail) || state?.gmail === "connected";
  const draftEditor = artifact ? (
    <div className="artifact">
      <Textarea
        aria-label="Edit your draft"
        className="artifact-editor"
        value={artifactBody}
        onChange={(event) => setArtifactEdit(event.target.value)}
      />
      <div className="artifact-actions">
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(artifactBody);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setError("Copy was blocked. Select and copy the draft instead.");
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy draft"}
        </Button>
        {artifactDirty && (
          <Button onClick={() => void saveArtifact()}>Save edits</Button>
        )}
      </div>
      <p className="fine-print">You can edit or copy this. Nothing is sent.</p>
    </div>
  ) : null;
  const gmailCard = (
    <section className="gmail-card" aria-label="Gmail connection">
      <div className="gmail-top">
        <div className="mail-icon"><Mail size={19} /></div>
        <div>
          <strong>
            {state?.gmail === "connected" ? "Gmail connected" : "Connect Gmail"}
          </strong>
          <span>
            {state?.gmail === "connected"
              ? state.gmailEmail
              : state?.gmail === "deferred"
                ? "Skipped for now"
                : state?.gmail === "failed"
                  ? "Connection did not finish"
                  : state?.gmail === "pending"
                    ? "Waiting for Google"
                    : capabilities.gmail
                      ? "Optional"
                      : "Unavailable in this demo"}
          </span>
        </div>
        {state?.gmail === "connected" && <ShieldCheck size={18} />}
      </div>
      <p>
        {state?.gmail === "connected"
          ? "Account verified. Tell me what email context you want help with; this demo does not read messages."
          : capabilities.gmail
            ? "Connect to verify your account. This demo does not read or send email."
            : "Gmail is not configured here. We can still continue."}
      </p>
      {state?.gmail !== "connected" && capabilities.gmail && (
        <Button
          variant="outline"
          className="gmail-button"
          onClick={() => void connect()}
          disabled={busy || state?.gmail === "pending"}
        >
          <Mail size={16} />
          {state?.gmail === "failed" ? "Try again" : "Connect Gmail"}
          <ArrowUpRight size={15} />
        </Button>
      )}
    </section>
  );
  return (
    <main className="app-shell">
      <section className="conversation-panel">
        <header className="conversation-header">
          <div className="header-brand">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            <div>
              <strong>Persona</strong>
              <span>{state?.agentName ? `Talking with ${name}` : "Your personal intelligence"}</span>
            </div>
          </div>
          <div className="header-actions">
            {showGmail && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="header-gmail">
                    <Mail size={16} />
                    <span>{state?.gmail === "connected" ? "Connected" : "Gmail"}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="details-sheet connection-sheet">
                  <SheetHeader>
                    <SheetTitle>Gmail</SheetTitle>
                    <SheetDescription>Optional account connection</SheetDescription>
                  </SheetHeader>
                  {gmailCard}
                </SheetContent>
              </Sheet>
            )}
            {capabilities.voice && state?.agentName && (
              <div className="header-call">
                {active ? (
                  <>
                    <Button variant="ghost" className="mute-button" onClick={voice.toggleMute} aria-label={voice.muted ? "Unmute microphone" : "Mute microphone"}>
                      {voice.muted ? <MicOff size={16} /> : <Mic size={16} />}
                    </Button>
                    <Button className="end-button" onClick={() => void voice.stop().catch((e) => setError(e.message))}>
                      <PhoneOff size={15} /> End call
                    </Button>
                  </>
                ) : (
                  <Button className="call-button" disabled={busy} onClick={() => { setError(""); void voice.start(); }}>
                    <Phone size={15} /> {state.call === "ended" || state.call === "failed" ? "Call again" : "Call"}
                  </Button>
                )}
              </div>
            )}
            <Sheet open={draftOpen} onOpenChange={setDraftOpen}>
              <SheetContent className="draft-sheet">
                <SheetHeader>
                  <SheetTitle>{artifact?.title || "Draft"}</SheetTitle>
                  <SheetDescription>
                    A starting point based on what you shared.
                  </SheetDescription>
                </SheetHeader>
                {draftEditor}
              </SheetContent>
            </Sheet>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="internals-trigger">
                  <Settings2 size={16} />
                  Internals
                </Button>
              </SheetTrigger>
              <SheetContent className="details-sheet">
                <SheetHeader>
                  <span className="eyebrow">ASSESSMENT VIEW</span>
                  <SheetTitle>Internals</SheetTitle>
                  <SheetDescription>
                    What the onboarding has learned and what it will do next.
                  </SheetDescription>
                </SheetHeader>
                <div className="details-content">
                  <div className="internals-note">
                    <strong>One conversation, two channels.</strong>
                    <p>Text and voice update the same confirmed facts. A call can end without losing the thread.</p>
                  </div>
                  <div className="internals-section-heading">
                    <span className="eyebrow">ONBOARDING GOALS</span>
                    <span>{state ? onboardingGoals(state, capabilities).filter((goal) => goal.status === "complete").length : 0}/4 captured</span>
                  </div>
                  <ol className="goal-list">
                    {state && onboardingGoals(state, capabilities).map((goal, index) => (
                      <li className={"goal-row status-" + goal.status} key={goal.key}>
                        <span className="goal-index">0{index + 1}</span>
                        <div className="goal-copy">
                          <strong>{goal.label}</strong>
                          <span>{goal.value}</span>
                        </div>
                        <span className="goal-status">{goal.status}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="internals-section-heading">
                    <span className="eyebrow">CHANNELS</span>
                  </div>
                  <div className="channel-grid">
                    <div><strong>Text</strong><span>{capabilities.ai ? "Live AI" : "Rehearsal"}</span></div>
                    <div><strong>Voice</strong><span>{capabilities.voice ? state?.call === "not_offered" ? "Ready" : state?.call || "Ready" : "Unavailable"}</span></div>
                    <div><strong>Gmail</strong><span>{state?.gmail === "connected" ? "Verified" : capabilities.gmail ? "Optional" : "Unavailable"}</span></div>
                  </div>
                  <div className="next-action">
                    <span className="eyebrow">NEXT USEFUL MOVE</span>
                    <p>{state ? nextAction(state, capabilities.voice, capabilities.gmail) : "Loading the conversation"}</p>
                  </div>
                  <div className="internals-section-heading">
                    <span className="eyebrow">RECENT EVENTS</span>
                    <span>v{state?.version ?? 0}</span>
                  </div>
                  <ul className="event-list">
                    {state?.events.length ? state.events.slice(-12).reverse().map((event) => (
                      <li key={event.id}>
                        <span>{event.label}</span>
                        <time>
                          {new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </time>
                      </li>
                    )) : <li><span>No events yet</span></li>}
                  </ul>
                  <p className="internals-footnote">
                    This panel shows application state and events, not model reasoning.
                  </p>
                </div>
              </SheetContent>
            </Sheet>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="reset-trigger" disabled={!state}>
                  <RotateCcw size={15} />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a new assessment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This clears this demo’s conversation, draft, and stored Gmail credentials.
                    It does not revoke Google’s authorization.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep this one</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void reset()}>
                    Reset conversation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>
        <div
          className="conversation-scroll"
          role="log"
          aria-label="Conversation"
          aria-live="polite"
        >
          {!state ? (
            <div className="loading-session">
              <LoaderCircle className="spin" />
              Getting your conversation ready…
              {error && (
                <Button variant="outline" onClick={() => void load()}>
                  Try again
                </Button>
              )}
            </div>
          ) : (
            state.messages.map((message) => (
              <div
                className={`message message-${message.role}`}
                key={message.id}
              >
                <div className="message-content">
                  <div className="message-label">
                    {message.role === "user"
                      ? state.userName || "You"
                      : message.role === "system"
                        ? "Session"
                        : message.id === "hello"
                          ? "Assistant"
                          : name}
                    {message.channel === "voice" && <AudioLines size={12} />}
                  </div>
                  <p>{message.content}</p>
                </div>
              </div>
            ))
          )}
          {optimistic && (
            <div className="message message-user message-pending" data-testid="optimistic-message">
              <div className="message-content"><div className="message-label">{state?.userName || "You"}</div><p>{optimistic.text}</p></div>
            </div>
          )}
          {busy && (
            <div className="message message-assistant">
              <div className="thinking" aria-label="Thinking">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          {state?.messages.length === 1 && !busy && (
            <div className="suggestions">
              <Button
                variant="outline"
                onClick={() => void send("You choose your name.")}
              >
                Choose for me
              </Button>
            </div>
          )}
          {capabilities.voice && state?.call === "offered" && state.messages.filter((message) => message.role === "user").length === 1 && !active && !busy && (
            <div className="call-invitation">
              <div>
                <Phone size={16} />
                <span>Want to talk this through?</span>
              </div>
              <Button variant="outline" onClick={() => void voice.start()}>
                Start browser call
                <ChevronRight size={14} />
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    accept((await api("call", { status: "declined" })).state);
                    inputRef.current?.focus();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Please retry.");
                  }
                }}
              >
                Continue in text
              </Button>
            </div>
          )}
          {artifact && (
            <section className="draft-card" aria-label="Your draft">
              <div className="draft-card-label"><FileText size={16} /> DRAFT READY</div>
              <h3>{artifact.title}</h3>
              <p>{artifact.body}</p>
              <Button variant="outline" onClick={() => setDraftOpen(true)}>
                Open draft <ChevronRight size={15} />
              </Button>
            </section>
          )}
          <div ref={end} />
        </div>
        <div className="composer-area">
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dismiss notice"
                onClick={() => setNotice("")}
              >
                <X size={14} />
              </Button>
            </div>
          )}
          {error && (
            <div className="error-message" role="alert">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={14} />
              </Button>
            </div>
          )}
          {state && !capabilities.ai && (
            <div className="rehearsal-note">Rehearsal mode · Live AI isn’t connected.</div>
          )}
          {state?.call === "ended" && !active && (
            <div className="channel-note">
              <MessageCircle size={13} />
              Call ended. Continue here whenever you’re ready.
            </div>
          )}
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <Textarea
              ref={inputRef}
              aria-label="Your message"
              placeholder={
                state?.agentName
                  ? `Message ${state.agentName}…`
                  : "Choose a name or tell me what you need…"
              }
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={!state || busy}
              maxLength={6000}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              type="submit"
              className="send-button"
              disabled={!text.trim() || busy || !state}
              size="icon"
              aria-label="Send message"
            >
              {busy ? <LoaderCircle className="spin" /> : <ArrowUp size={20} />}
            </Button>
          </form>
          <div className="composer-footnote">
            <span>
              {active
                ? "Send a message to switch back to text."
                : "Shift + Enter for a new line"}
            </span>
            <span>↵ to send</span>
          </div>
        </div>
      </section>
    </main>
  );
}
