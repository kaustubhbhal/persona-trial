"use client";

import type { ReactNode } from "react";
import { ArrowLeft, AudioLines, MessageCircle, Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Caption = { role: "user" | "assistant"; text: string } | null;

type Props = {
  agentName: string;
  userName: string;
  phase: string;
  muted: boolean;
  caption: Caption;
  action?: ReactNode;
  onMute: () => void;
  onEnd: () => void;
  onReturnToText: () => void;
};

const phaseCopy: Record<string, string> = {
  connecting: "Connecting your call…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function CallStage({ agentName, userName, phase, muted, caption, action, onMute, onEnd, onReturnToText }: Props) {
  return (
    <section className="call-stage" role="dialog" aria-modal="true" aria-label={`Call with ${agentName}`}>
      <header className="call-stage-header">
        <span className="call-stage-brand"><span className="brand-mark" aria-hidden="true"><span /><span /></span>Persona</span>
        <Button variant="ghost" onClick={onReturnToText}><ArrowLeft size={16} /> Back to chat</Button>
      </header>
      <div className="call-stage-body">
        <div className="call-stage-center">
          <span className="call-stage-eyebrow">BROWSER CALL</span>
          <div className={`call-presence phase-${phase}`} aria-hidden="true"><AudioLines size={58} strokeWidth={1.5} /></div>
          <h1>{agentName}</h1>
          <p className="call-stage-status" role="status"><span className="call-status-dot" />{muted ? "Microphone muted" : phaseCopy[phase] || "On the call"}</p>
          <p className="call-stage-hint">{phase === "connecting" ? "You can head back to text at any time." : `Just talk${userName ? `, ${userName}` : ""}. I’m here.`}</p>
        </div>
        <div className="call-stage-lower">
          <div className="call-caption" aria-live="polite">
            <span>{caption ? caption.role === "user" ? "YOU SAID" : `${agentName.toUpperCase()} SAID` : "CONVERSATION"}</span>
            <p>{caption?.text || "What we say will appear here as the call continues."}</p>
          </div>
          {action}
        </div>
      </div>
      <footer className="call-stage-footer">
        <Button variant="outline" className="call-control" onClick={onMute} disabled={phase === "connecting"} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
          <span>{muted ? "Unmute" : "Mute"}</span>
        </Button>
        <Button className="call-control call-control-end" onClick={onEnd}>
          <PhoneOff size={22} /><span>End call</span>
        </Button>
        <Button variant="outline" className="call-control call-control-chat" onClick={onReturnToText}>
          <MessageCircle size={22} /><span>Text instead</span>
        </Button>
      </footer>
    </section>
  );
}
