"use client";

import { Download, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { LabTrackMark } from "@/components/branding/labtrack-mark";

export function QrCard({ payload, label, caption }: { payload: string; label: string; caption?: string }) {
  function download() {
    const svg = document.querySelector(`[data-qr-id="${CSS.escape(label)}"] svg`);
    if (!(svg instanceof SVGElement)) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${label.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  return (
    <article className="qr-card" data-qr-id={label}>
      <div className="qr-card-mark"><LabTrackMark /><span><small>AISAT DAVAO</small>LABTRACK QR</span><QrCode aria-hidden="true" /></div>
      <div className="qr-canvas"><QRCodeSVG value={payload} size={220} level="M" marginSize={2} /></div>
      <h2>{label}</h2>{caption && <p>{caption}</p>}
      <button className="button button-secondary" type="button" onClick={download}><Download aria-hidden="true" />Download SVG</button>
    </article>
  );
}
