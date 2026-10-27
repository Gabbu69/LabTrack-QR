import "server-only";

export type TurnstileAction = "login" | "password_reset";
export const TURNSTILE_ERROR = "Security check failed or expired. Please try again.";

export async function verifyTurnstile(token: string, action: TurnstileAction): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hosts = (process.env.TURNSTILE_HOSTNAMES ?? "").split(",").map(host => host.trim()).filter(Boolean);
  // Missing configuration never silently disables verification. Test keys belong
  // only in isolated development, never in a Vercel production deployment.
  if (!secret || !hosts.length || !token || token.length > 2048) return false;
  if (process.env.VERCEL_ENV === "production" && /^[123]x000000/.test(secret)) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && result.action === action && hosts.includes(result.hostname);
  } catch { return false; }
}
