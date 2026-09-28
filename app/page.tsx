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
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
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
  const voice = useVoice(accept, setError, state);
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
    try {
      if (voice.active) await voice.stop();
      const data = await api("turn", {
        text: message,
        id: pendingTurn.current.id,
      });
      accept(data.state);
      setText("");
      pendingTurn.current = null;
    } catch (e) {
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
      setArtifactEdit(null);
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
  const name = state?.agentName || "Your plus-one";
  const active = voice.active;
  const callLabel =
    voice.phase === "connecting"
      ? "Connecting…"
      : voice.muted
        ? "Microphone muted"
        : voice.phase === "thinking"
          ? "Thinking with you"
          : voice.phase === "speaking"
            ? `${name} is speaking`
            : "Listening to you";
  const artifact = state?.artifact;
  const workspace = (
    <>
      <div className="workspace-heading">
        <span className="eyebrow">YOUR WORKSPACE</span>
        <span className="workspace-number">01</span>
      </div>
      {artifact ? (
        <div className="artifact">
          <div className="artifact-icon">
            <FileText size={20} />
            <span>Working draft</span>
          </div>
          <h2>{artifact.title}</h2>
          <Textarea
            aria-label="Edit your working draft"
            className="artifact-editor"
            value={artifactBody}
            onChange={(event) => {
              setArtifactEdit(event.target.value);
            }}
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
                  setError(
                    "Copy was blocked by your browser. Select and copy the draft instead.",
                  );
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
          <p className="fine-print">
            Yours to edit. Nothing is sent automatically.
          </p>
        </div>
      ) : (
        <div className="workspace-empty">
          <div className="paper-symbol">
            <FileText size={26} />
            <span>
              <Plus size={12} />
            </span>
          </div>
          <h2>
            A little less
            <br />
            on your plate.
          </h2>
          <p>
            Tell me what you’re working through. We’ll turn it into something
            useful, right here.
          </p>
          <div className="empty-examples">
            <span>
              <span className="tiny-line" />A reply you’ve been putting off
            </span>
            <span>
              <span className="tiny-line" />A plan for a busy week
            </span>
            <span>
              <span className="tiny-line" />
              Somewhere to start
            </span>
          </div>
        </div>
      )}
      <div className="gmail-card">
        <div className="gmail-top">
          <div className="mail-icon">
            <Mail size={20} />
          </div>
          <div>
            <strong>
              {state?.gmail === "connected"
                ? "Gmail is connected"
                : "A little more context"}
            </strong>
            <span>
              {state?.gmail === "connected"
                ? state.gmailEmail
                : "Connect Gmail when you’re ready"}
            </span>
          </div>
          {state?.gmail === "connected" && <Check size={18} />}
        </div>
        <p>
          {state?.gmail === "connected"
            ? "Your account is verified. For this assessment, share the email context you’d like help with."
            : "Connect your account, or tell me what I need to know. Either way, we can get started."}
        </p>
        {state?.gmail !== "connected" && (
          <Button
            variant="outline"
            className="gmail-button"
            onClick={() => void connect()}
            disabled={busy}
          >
            <Mail size={16} />
            {state?.gmail === "failed" ? "Try Gmail again" : "Connect Gmail"}
            <ArrowUpRight size={15} />
          </Button>
        )}
        <div className="permission-note">
          <ShieldCheck size={12} />
          You decide what to share.
        </div>
      </div>
    </>
  );
  return (
    <main className="app-shell">
      <aside className="companion-panel">
        <div className="wordmark" aria-label="Persona">
          <span className="brand-mark">
            <span />
            <span />
          </span>
          persona<span className="wordmark-period">.</span>
        </div>
        <div className="companion-main">
          <div className="intro-label">
            <span className="small-dash" />
            {state?.helping ? "A LITTLE MOMENTUM" : "A GOOD PLACE TO START"}
          </div>
          <h1>
            {state?.helping ? (
              <>
                Let’s take
                <br />
                one thing
                <br />
                <em>off your plate.</em>
              </>
            ) : (
              <>
                Your day,
                <br />
                with a little
                <br />
                <em>more room.</em>
              </>
            )}
          </h1>
          <div
            className={`voice-presence ${active ? "is-active" : ""}`}
            aria-hidden="true"
          >
            <div className="presence-ring outer" />
            <div className="presence-ring inner" />
            <div className="presence-core">
              <div className="sound-bars">
                {[12, 25, 38, 29, 45, 25, 15].map((height, i) => (
                  <span
                    key={i}
                    style={{ height, animationDelay: `${i * 0.13}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="companion-identity">
            <h2>{name}</h2>
            <p>
              {active
                ? callLabel
                : state?.agentName
                  ? "Your personal assistant"
                  : "An assistant that gets to know you"}
            </p>
          </div>
          <div className="call-controls">
            {active ? (
              <>
                <Button
                  className="mute-button"
                  variant="outline"
                  onClick={voice.toggleMute}
                  aria-label={
                    voice.muted ? "Unmute microphone" : "Mute microphone"
                  }
                >
                  {voice.muted ? <MicOff /> : <Mic />}
                </Button>
                <Button
                  className="end-button"
                  onClick={() =>
                    void voice.stop().catch((e) => setError(e.message))
                  }
                >
                  <PhoneOff size={17} />
                  End call
                </Button>
              </>
            ) : (
              <Button
                className="call-button"
                disabled={!state || busy}
                onClick={() => {
                  setError("");
                  void voice.start();
                }}
              >
                <Phone size={17} />
                {state?.call === "ended" || state?.call === "failed"
                  ? "Call again"
                  : "Let’s talk"}
                <span>↗</span>
              </Button>
            )}
          </div>
          <p className="call-caption">
            {active
              ? "You can interrupt. I’m listening."
              : "A quick call, right in your browser."}
          </p>
        </div>
        <div className="companion-footer">
          <span className="footer-flower">✳</span>
          <p>
            At your pace.
            <br />
            Always on your side.
          </p>
          <span className="session-label">FIRST CONVERSATION</span>
        </div>
      </aside>
      <section className="conversation-panel">
        <header className="conversation-header">
          <div>
            <span className="eyebrow">
              {state?.helping
                ? "LET’S GET INTO IT"
                : "LET’S GET TO KNOW EACH OTHER"}
            </span>
            <h2>
              {state?.userName
                ? `A little space for you, ${state.userName}.`
                : "Make yourself at home."}
            </h2>
          </div>
          <div className="header-actions">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  className="workspace-toggle"
                  size="icon"
                  variant="ghost"
                  aria-label="Open workspace"
                >
                  <FileText />
                </Button>
              </SheetTrigger>
              <SheetContent className="mobile-workspace">
                <SheetHeader>
                  <SheetTitle>Your workspace</SheetTitle>
                  <SheetDescription>
                    Drafts, plans, and your Gmail connection.
                  </SheetDescription>
                </SheetHeader>
                {workspace}
              </SheetContent>
            </Sheet>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open session details"
                >
                  <Settings2 size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent className="details-sheet">
                <SheetHeader>
                  <SheetTitle>Under the hood</SheetTitle>
                  <SheetDescription>
                    Confirmed facts and application events. No hidden reasoning.
                  </SheetDescription>
                </SheetHeader>
                <div className="details-content">
                  <span className="eyebrow">THIS SESSION</span>
                  <dl>
                    {[
                      ["Agent", state?.agentName || "Not chosen"],
                      ["You", state?.userName || "Not shared"],
                      ["Need", state?.need || "Still exploring"],
                      ["Gmail", state?.gmail || "Not connected"],
                      ["Call", state?.call || "Not offered"],
                      ["Helping", state?.helping ? "Yes" : "Not yet"],
                      [
                        "Text",
                        capabilities.ai ? "Live AI" : "Limited rehearsal",
                      ],
                      [
                        "Voice",
                        capabilities.voice
                          ? "Deepgram configured"
                          : "Needs Deepgram key",
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="next-action">
                    <strong>Next useful move</strong>
                    <p>
                      {state ? nextAction(state) : "Loading the conversation"}
                    </p>
                  </div>
                  <span className="eyebrow">RECENT EVENTS</span>
                  <ul className="event-list">
                    {state?.events
                      .slice(-12)
                      .reverse()
                      .map((event) => (
                        <li key={event.id}>
                          <span>{event.label}</span>
                          <time>
                            {new Date(event.at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </li>
                      ))}
                  </ul>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">
                        <RotateCcw />
                        Start a fresh conversation
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Start fresh?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This deletes this assessment’s conversation, draft,
                          and saved Gmail credentials. It does not change your
                          Orbit account.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          Keep this conversation
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => void reset()}>
                          Start fresh
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>
        <div
          className="conversation-scroll"
          role="log"
          aria-label="Conversation"
          aria-live="polite"
        >
          <div className="date-marker">
            <span />
            TODAY · A FRESH START
            <span />
          </div>
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
                {message.role === "assistant" && (
                  <div className="message-avatar">
                    <span className="mini-mark">✳</span>
                  </div>
                )}
                <div className="message-content">
                  <div className="message-label">
                    {message.role === "user"
                      ? state.userName || "You"
                      : message.role === "system"
                        ? "Session"
                        : name}
                    {message.channel === "voice" && <AudioLines size={12} />}
                  </div>
                  <p>{message.content}</p>
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="message message-assistant">
              <div className="message-avatar">
                <span className="mini-mark">✳</span>
              </div>
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
                onClick={() => void send("Let’s call you Milo.")}
              >
                <span>Milo</span>
                <Plus size={14} />
              </Button>
              <Button
                variant="outline"
                onClick={() => void send("Let’s call you Sunny.")}
              >
                <span>Sunny</span>
                <Plus size={14} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => void send("You choose your name.")}
              >
                <Sparkles size={14} />
                You choose
              </Button>
            </div>
          )}
          {state?.call === "offered" && !active && !busy && (
            <div className="call-invitation">
              <div>
                <Phone size={16} />
                <span>Same conversation. A little more human.</span>
              </div>
              <Button variant="outline" onClick={() => void voice.start()}>
                Hop on a call
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
                Keep typing
              </Button>
            </div>
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
            <div className="rehearsal-note">
              Limited rehearsal mode · Live AI isn’t configured here yet.
            </div>
          )}
          {state?.call === "ended" && !active && (
            <div className="channel-note">
              <MessageCircle size={13} />
              Same conversation. We can keep going here.
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
                  ? `Tell ${state.agentName} what’s on your mind…`
                  : "A name, a thought, whatever’s on your mind…"
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
                : "No perfect answers needed."}
            </span>
            <span>↵ to send</span>
          </div>
        </div>
      </section>
      <aside className="workspace-panel">{workspace}</aside>
    </main>
  );
}
