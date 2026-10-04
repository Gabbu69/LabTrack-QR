// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";
import { QrCard } from "@/components/qr/qr-card";
import { studentQrPayload, toolQrPayload } from "@/lib/qr";

let downloads: Blob[];
let filenames: string[];
beforeEach(() => {
  downloads = []; filenames = [];
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: vi.fn((blob: Blob) => { downloads.push(blob); return "blob:test-qr-download"; }),
    revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { filenames.push(this.download); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function read(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

it.each([
  ["student", studentQrPayload("550e8400-e29b-41d4-a716-446655440011")],
  ["tool", toolQrPayload("550e8400-e29b-41d4-a716-446655440012")],
])("downloads a decodable %s QR from its own card even when another card uses the same label", async (_kind, payload) => {
  const firstPayload = toolQrPayload("550e8400-e29b-41d4-a716-446655440099");
  render(createElement("div", {},
    createElement(QrCard, { payload: firstPayload, label: "Shared label" }),
    createElement(QrCard, { payload, label: "Shared label" })));
  const secondCard = screen.getAllByRole("article")[1];
  fireEvent.click(within(secondCard).getByRole("button", { name: "Download SVG" }));
  expect(downloads).toHaveLength(1); expect(downloads[0].type).toBe("image/svg+xml");
  expect(filenames).toEqual(["shared-label-qr.svg"]);
  const svg = await read(downloads[0]);
  expect(svg).not.toContain("mark-aircraft");
  const { data, info } = await sharp(Buffer.from(svg)).resize(440, 440).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  const source = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
  expect(new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(source))).getText()).toBe(payload);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-qr-download");
});
