import { getSession } from "@/lib/persona/store";
import { finishGoogle } from "@/lib/persona/google";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let result = "failed";
  try {
    const { row } = await getSession(request);
    result = await finishGoogle(request, row);
  } catch {
    /* Never expose OAuth codes, tokens or provider errors. */
  }
  const nonce = crypto.randomUUID();
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Back to your conversation</title><body><p>You can close this window and return to your conversation.</p><a href="/?google=${result}">Return to Persona</a><script nonce="${nonce}">if(window.opener){window.opener.postMessage({type:'persona:google',result:'${result}'},window.location.origin);window.close();}else{window.location.replace('/?google=${result}');}</script></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      },
    },
  );
}
