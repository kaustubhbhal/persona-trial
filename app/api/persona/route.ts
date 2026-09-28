import {
  apply,
  database,
  getSession,
  input,
  json,
  lockTurn,
  sameOrigin,
  setting,
  unlockTurn,
} from "@/lib/persona/store";
import { clean, type Proposal } from "@/lib/persona/state";
import { respond } from "@/lib/persona/conversation";
import { googleConfigured, startGoogle } from "@/lib/persona/google";
import { voiceConfig } from "@/lib/persona/voice-config";
import { grantVoiceToken, voiceAvailable } from "@/lib/persona/voice-availability";
export const dynamic = "force-dynamic";
async function capabilities() {
  return {
    ai: Boolean(setting("OPENAI_API_KEY")),
    voice: await voiceAvailable(setting("DEEPGRAM_API_KEY")),
    gmail: googleConfigured(),
  };
}
export async function GET(request: Request) {
  try {
    const session = await getSession(request, true);
    return json(
      { state: session.state, capabilities: await capabilities() },
      200,
      session.cookie,
    );
  } catch {
    return json(
      { error: "Conversation storage is unavailable. Please retry." },
      503,
    );
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await input(request);
    const { row, state } = await getSession(request);
    const id = clean(body.id, 100);
    if (!id) return json({ error: "A request ID is required." }, 400);
    if (body.action === "reset") {
      await database()
        .prepare("DELETE FROM persona_sessions WHERE id=?")
        .bind(row.id)
        .run();
      return json(
        { ok: true },
        200,
        "persona_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      );
    }
    if (body.action === "google") {
      return json({ url: await startGoogle(request, row) });
    }
    if (body.action === "voice-token") {
      if (!setting("DEEPGRAM_API_KEY"))
        return json(
          {
            error:
              "Voice is not connected yet. We can keep going here in text.",
          },
          503,
        );
      if (!(await lockTurn(row.id, id)))
        return json({ error: "One moment—another request is finishing." }, 409);
      try {
        const token = await grantVoiceToken(setting("DEEPGRAM_API_KEY"));
        return json({
          token,
          agent: voiceConfig(state, setting("DEEPGRAM_VOICE"), googleConfigured()),
        });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Voice is unavailable right now." }, 503);
      } finally {
        await unlockTurn(row.id, id);
      }
    }
    if (body.action === "turn") {
      if (state.processed.includes(id)) return json({ state });
      if (state.messages.filter((m) => m.role === "user").length >= 100)
        return json(
          {
            error:
              "This assessment session is full. Start a fresh conversation from the menu.",
          },
          429,
        );
      const text = clean(body.text, 6000);
      if (!text) return json({ error: "Write something first." }, 400);
      if (!(await lockTurn(row.id, id)))
        return json(
          {
            error:
              "Another reply is still finishing. Please try again in a moment.",
          },
          409,
        );
      try {
        const latest = await getSession(request);
        const canCall = await voiceAvailable(setting("DEEPGRAM_API_KEY"));
        const proposal = await respond(
          latest.state,
          text,
          setting("OPENAI_API_KEY"),
          setting("PERSONA_OPENAI_MODEL"),
          canCall,
          googleConfigured(),
        );
        const next = await apply(row.id, { id, type: "turn", text, proposal, callAvailable: canCall });
        return json({ state: next });
      } finally {
        await unlockTurn(row.id, id);
      }
    }
    if (body.action === "call") {
      const status = clean(body.status);
      if (
        !["offered", "active", "ended", "declined", "failed"].includes(status)
      )
        return json({ error: "Invalid call status." }, 400);
      return json({ state: await apply(row.id, { id, type: "call", status }) });
    }
    if (body.action === "transcript") {
      if (!["user", "assistant"].includes(String(body.role)))
        return json({ error: "Invalid transcript role." }, 400);
      return json({
        state: await apply(row.id, {
          id,
          type: "transcript",
          role: body.role as "user" | "assistant",
          channel: "voice",
          text: clean(body.text, 6000),
        }),
      });
    }
    if (body.action === "profile") {
      const raw = body.proposal as Proposal | undefined;
      if (!raw || typeof raw !== "object")
        return json({ error: "Invalid profile update." }, 400);
      // Voice may learn the user/task, never authorize Gmail or rename itself.
      const proposal: Proposal = {
        userName: clean(raw.userName, 80),
        need: clean(raw.need, 1500),
        deferGmail: raw.deferGmail === true,
        artifact: raw.artifact,
      };
      return json({
        state: await apply(row.id, {
          id,
          type: "profile",
          proposal,
          channel: "voice",
        }),
      });
    }
    if (body.action === "artifact") {
      const raw = body.artifact as
        | { title?: unknown; body?: unknown }
        | undefined;
      if (!raw) return json({ error: "Missing draft." }, 400);
      return json({
        state: await apply(row.id, {
          id,
          type: "artifact",
          artifact: { title: clean(raw.title), body: clean(raw.body, 12000) },
        }),
      });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please retry.",
      },
      400,
    );
  }
}
