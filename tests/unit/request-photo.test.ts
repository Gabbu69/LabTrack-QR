import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { jsonRequest } from "@/lib/json-request";
import { normalizeProfilePhoto } from "@/lib/profile-photo";

afterEach(() => vi.unstubAllGlobals());
describe("client request recovery", () => {
  it("turns HTML session redirects into useful guidance", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Login</html>", { headers: { "content-type": "text/html" } })));
    await expect(jsonRequest("/api/borrow")).rejects.toThrow(/Sign in again/);
  });
  it("handles lost connections", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(jsonRequest("/api/borrow")).rejects.toThrow(/Connection lost/);
  });
  it("preserves a safe API error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Tool already borrowed" }, { status: 409 })));
    await expect(jsonRequest("/api/borrow")).rejects.toThrow("Tool already borrowed");
  });
});
describe("profile photo decoding", () => {
  it("rejects an SVG disguised as PNG", async () => {
    await expect(normalizeProfilePhoto(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "photo.png", { type: "image/png" }))).rejects.toThrow(/could not be read/);
  });
  it("rejects oversized images before decoding", async () => {
    await expect(normalizeProfilePhoto(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "photo.png", { type: "image/png" }))).rejects.toThrow(/2 MB/);
  });
  it("decodes and resizes a valid image to safe WebP", async () => {
    const original = await sharp({ create: { width: 800, height: 600, channels: 3, background: "blue" } }).png().toBuffer();
    const file = new File([new Uint8Array(original)], "photo.png", { type: "image/png" });
    const output = await normalizeProfilePhoto(file); const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("webp"); expect(metadata.width).toBe(512); expect(metadata.height).toBe(384);
  });
});
