export type ParsedQr = { kind: "student" | "tool"; token: string };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const QR_PATTERN = new RegExp(`^LTQR1:(S|T):(${UUID})$`, "i");

export function parseQrPayload(value: string): ParsedQr | null {
  const match = QR_PATTERN.exec(value.trim());
  if (!match) return null;
  return { kind: match[1].toUpperCase() === "S" ? "student" : "tool", token: match[2].toLowerCase() };
}

export function studentQrPayload(token: string) { return `LTQR1:S:${token}`; }
export function toolQrPayload(token: string) { return `LTQR1:T:${token}`; }
