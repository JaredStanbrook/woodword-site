// worker/lib/email.ts
//
// Order emails through Resend's HTTP API, when RESEND_API_KEY and EMAIL_FROM
// are set. Without them nothing is sent and the order page is the
// confirmation — which it always is anyway, so a failed email never loses an
// order. Swap the provider here; nothing else knows which one it is.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(
  env: { RESEND_API_KEY?: string; EMAIL_FROM?: string },
  email: Email,
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, ...email }),
    });
    if (!res.ok) console.warn(`[email] Resend refused "${email.subject}": ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn(`[email] could not send "${email.subject}":`, err);
    return false;
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
