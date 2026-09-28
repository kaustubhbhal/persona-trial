"use client";

import { ArrowUpRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  failed: boolean;
  busy: boolean;
  onConnect: () => void;
  onSkip: () => void;
};

export function GmailAction({ failed, busy, onConnect, onSkip }: Props) {
  return (
    <section className="gmail-action" aria-label="Gmail next step">
      <div className="gmail-action-icon"><Mail size={19} /></div>
      <div className="gmail-action-copy">
        <strong>{failed ? "Gmail didn't connect" : "Connect Gmail"}</strong>
        <p>Optional. Verify your account without giving this demo access to read or send mail.</p>
        <div className="gmail-action-buttons">
          <Button onClick={onConnect} disabled={busy}>
            {failed ? "Try connecting again" : "Connect Gmail"} <ArrowUpRight size={15} />
          </Button>
          <Button variant="ghost" onClick={onSkip} disabled={busy}>Not now</Button>
        </div>
      </div>
    </section>
  );
}
