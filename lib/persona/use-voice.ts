"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentSession,
  AgentMicrophone,
  AgentPlayer,
  AgentSettingsObject,
} from "@deepgram/agents";
import { api } from "./client";
import { prompt } from "./conversation";
import type { State } from "./state";
export function useVoice(
  onState: (s: State) => void,
  onError: (message: string) => void,
  state: State | null,
  canGmail = false,
) {
  const [phase, setPhase] = useState("idle");
  const [muted, setMuted] = useState(false);
  const resources = useRef<{
    session?: AgentSession;
    mic?: AgentMicrophone;
    player?: AgentPlayer;
    cancelled: boolean;
  } | null>(null);
  const serial = useRef(Promise.resolve());
  const callbacks = useRef({ onState, onError });
  useEffect(() => {
    callbacks.current = { onState, onError };
  }, [onState, onError]);
  const enqueue = useCallback((work: () => Promise<void>) => {
    const next = serial.current.then(work);
    serial.current = next.catch((error) =>
      callbacks.current.onError(
        error instanceof Error
          ? error.message
          : "Could not save this part of the call.",
      ),
    );
    return next;
  }, []);
  const cleanup = useCallback(() => {
    const r = resources.current;
    if (r) {
      r.cancelled = true;
      r.mic?.stop();
      r.player?.dispose();
      r.session?.disconnect();
      resources.current = null;
    }
    setPhase("idle");
    setMuted(false);
  }, []);
  const stop = useCallback(
    async (status = "ended") => {
      cleanup();
      await enqueue(async () => {
        const data = await api("call", { status });
        callbacks.current.onState(data.state);
      });
    },
    [cleanup, enqueue],
  );
  useEffect(
    () => () => {
      const r = resources.current;
      if (r) {
        r.cancelled = true;
        r.mic?.stop();
        r.player?.dispose();
        r.session?.disconnect();
      }
    },
    [],
  );
  const latestState = useRef(state);
  useEffect(() => {
    latestState.current = state;
  }, [state]);
  useEffect(() => {
    const current = latestState.current;
    if (
      current &&
      resources.current?.session &&
      resources.current.session.state === "connected"
    )
      resources.current.session.updatePrompt(prompt(current, true, false, canGmail));
  }, [state?.agentName, state?.userName, state?.need, state?.gmail, state?.gmailEmail, state?.artifact?.title, state?.artifact?.body, canGmail]); // Keep confirmed facts current during the call.
  const start = useCallback(async () => {
    if (resources.current) return;
    const r: {
      session?: AgentSession;
      mic?: AgentMicrophone;
      player?: AgentPlayer;
      cancelled: boolean;
    } = { cancelled: false };
    resources.current = r;
    setPhase("connecting");
    try {
      const config = await api<{ token: string; agent: AgentSettingsObject }>(
        "voice-token",
      );
      if (r.cancelled) return;
      const { AgentSession, AgentMicrophone, AgentPlayer } =
        await import("@deepgram/agents");
      if (r.cancelled) return;
      // The first short-lived token is used once; future reconnects fetch a fresh one.
      let first = true;
      r.session = new AgentSession({
        auth: {
          tokenFactory: async () => {
            if (first) {
              first = false;
              return config.token;
            }
            return (await api<{ token: string }>("voice-token")).token;
          },
        },
        agent: config.agent,
        reconnect: { enabled: false },
        audio: {
          input: { encoding: "linear16", sampleRate: 16000 },
          output: { encoding: "linear16", sampleRate: 24000 },
        },
      });
      const session = r.session;
      r.player = new AgentPlayer({ sampleRate: 24000 });
      r.mic = new AgentMicrophone((data) => session.sendAudio(data), {
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      });
      session.on("audio", (data) => {
        if (!r.cancelled) r.player?.queue(data);
      });
      session.on("user-started-speaking", () => {
        if (r.cancelled) return;
        r.player?.interrupt();
        setPhase("listening");
      });
      session.on("agent-thinking", () => {
        if (!r.cancelled) setPhase("thinking");
      });
      session.on("agent-started-speaking", () => {
        if (!r.cancelled) setPhase("speaking");
      });
      session.on("agent-audio-done", () => {
        if (!r.cancelled) setPhase("listening");
      });
      session.on("settings-applied", () => {
        if (!r.cancelled) setPhase("listening");
      });
      session.on("conversation-text", (message) => {
        if (r.cancelled) return;
        void enqueue(async () => {
          const data = await api("transcript", {
            role: message.role,
            text: message.content,
            id: crypto.randomUUID(),
          });
          callbacks.current.onState(data.state);
        }).catch(() => {});
      });
      session.on("function-call-request", (message) => {
        for (const fn of message.functions) {
          void enqueue(async () => {
            try {
              if (fn.name !== "remember_context")
                throw new Error("Unknown function");
              const data = await api("profile", {
                proposal: JSON.parse(fn.arguments),
                id: fn.id || crypto.randomUUID(),
              });
              callbacks.current.onState(data.state);
              if (!r.cancelled)
                session.sendFunctionCallResponse(
                  fn.id,
                  fn.name,
                  JSON.stringify({
                    saved: true,
                    profile: {
                      name: data.state.userName,
                      need: data.state.need,
                      gmail: data.state.gmail,
                    },
                  }),
                );
            } catch {
              if (!r.cancelled)
                session.sendFunctionCallResponse(
                  fn.id,
                  fn.name,
                  JSON.stringify({
                    saved: false,
                    error:
                      "Could not save. Please ask the user to retry in text.",
                  }),
                );
              callbacks.current.onError(
                "Part of the call could not be saved. Please confirm it in text.",
              );
            }
          }).catch(() => {});
        }
      });
      const fail = () => {
        if (!r.cancelled) {
          callbacks.current.onError(
            "The call was interrupted. Your saved conversation is here; continue in text or call again.",
          );
          void stop("failed").catch(() => {});
        }
      };
      session.on("disconnected", fail);
      session.on("sdk-error", fail);
      session.on("error", fail);
      r.mic.on("error", fail);
      // Acquire permission before connecting so the assistant never speaks into a denied call.
      await r.mic.start();
      if (r.cancelled) {
        r.mic.stop();
        return;
      }
      await session.connect();
      if (r.cancelled) {
        r.mic.stop();
        session.disconnect();
        return;
      }
      await enqueue(async () => {
        if (r.cancelled) return;
        const data = await api("call", { status: "active" });
        callbacks.current.onState(data.state);
      });
    } catch (error) {
      if (r.cancelled) return;
      cleanup();
      callbacks.current.onError(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Your microphone is off. No problem—we can keep going in text."
          : error instanceof Error
            ? error.message
            : "Could not start the call. Try text instead.",
      );
      try {
        const data = await api("call", { status: "failed" });
        callbacks.current.onState(data.state);
      } catch {}
    }
  }, [cleanup, enqueue, stop]);
  const toggleMute = useCallback(() => {
    const mic = resources.current?.mic;
    if (!mic) return;
    if (mic.muted) {
      mic.unmute();
      setMuted(false);
    } else {
      mic.mute();
      setMuted(true);
    }
  }, []);
  return { phase, muted, start, stop, toggleMute, active: phase !== "idle" };
}
