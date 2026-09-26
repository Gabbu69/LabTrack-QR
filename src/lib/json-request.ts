export async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, init); }
  catch { throw new Error("Connection lost. Check your connection and try again."); }
  if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Your session may have expired. Sign in again before continuing.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "This request could not be completed. Try again.");
  if (data === null) throw new Error("The service returned an incomplete response. Try again.");
  return data as T;
}
