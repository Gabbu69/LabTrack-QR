"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Camera, CameraOff, ImageUp, Keyboard, ScanLine } from "lucide-react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

export function QrScanner({ expected, onScan, disabled = false }: { expected: "student" | "tool"; onScan: (value: string) => void | Promise<void>; disabled?: boolean }) {
  const [cameraOn, setCameraOn] = useState(false); const [cameraError, setCameraError] = useState(""); const [manual, setManual] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null); const controlsRef = useRef<IScannerControls | null>(null); const lastScan = useRef({ value: "", at: 0 });
  const pendingScan = useRef(false); const cameraGeneration = useRef(0); const startingCamera = useRef(false);
  const latest = useRef({ disabled, onScan });
  const syncLatest = useEffectEvent(() => { latest.current = { disabled, onScan }; });
  useEffect(() => { syncLatest(); });
  const emit = useCallback(async (value: string) => {
    const clean = value.trim(); if (!clean || latest.current.disabled || pendingScan.current) return;
    const now = Date.now(); if (lastScan.current.value === clean && now - lastScan.current.at < 1800) return;
    pendingScan.current = true; lastScan.current = { value: clean, at: now };
    try { await latest.current.onScan(clean); }
    catch { setCameraError("The scan could not be processed. Please try again."); }
    finally { pendingScan.current = false; }
  }, []);
  const stopCamera = useCallback(() => { cameraGeneration.current += 1; controlsRef.current?.stop(); controlsRef.current = null; BrowserQRCodeReader.releaseAllStreams(); setCameraOn(false); }, []);
  useEffect(() => stopCamera, [stopCamera]);
  async function startCamera() {
    if (startingCamera.current || disabled) return;
    startingCamera.current = true;
    const generation = ++cameraGeneration.current;
    setCameraError("");
    try {
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
      const controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" } } }, videoRef.current ?? undefined, (result) => { if (result && generation === cameraGeneration.current) void emit(result.getText()); });
      if (generation !== cameraGeneration.current) { controls.stop(); return; }
      controlsRef.current = controls; setCameraOn(true);
    } catch { setCameraError("Camera could not start. Allow camera access, or use a USB scanner, typed code, or image upload."); stopCamera(); }
    finally { startingCamera.current = false; }
  }
  async function uploadImage(file?: File) {
    if (!file || disabled) return;
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setCameraError("Choose a JPEG, PNG, or WebP QR image no larger than 5 MB."); return; }
    setCameraError(""); const url = URL.createObjectURL(file); const generation = cameraGeneration.current;
    try { const result = await new BrowserQRCodeReader().decodeFromImageUrl(url); if (generation === cameraGeneration.current) await emit(result.getText()); }
    catch { setCameraError("No readable QR code was found in that image."); }
    finally { URL.revokeObjectURL(url); }
  }
  return (
    <section className="scanner-card" aria-label={`${expected} QR scanner`}>
      <div className={`camera-frame ${cameraOn ? "active" : ""}`}><video ref={videoRef} muted playsInline aria-label="Camera preview" />{!cameraOn && <div className="camera-placeholder"><ScanLine aria-hidden="true" /><strong>Camera is off</strong><small>It starts only when you choose Start camera.</small></div>}<span className="scan-corner one" /><span className="scan-corner two" /><span className="scan-corner three" /><span className="scan-corner four" /></div>
      <div className="scanner-controls"><button className="button button-primary" type="button" onClick={cameraOn ? stopCamera : startCamera} disabled={disabled}>{cameraOn ? <CameraOff aria-hidden="true" /> : <Camera aria-hidden="true" />}{cameraOn ? "Stop camera" : "Start rear camera"}</button><label className="button button-secondary file-button"><ImageUp aria-hidden="true" />Upload QR image<input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} disabled={disabled} /></label></div>
      <form className="manual-scan" onSubmit={(event) => { event.preventDefault(); emit(manual); setManual(""); }}><Keyboard aria-hidden="true" /><label><span>USB scanner or typed {expected === "student" ? "Student ID" : "asset code"}</span><input value={manual} onChange={(event) => setManual(event.target.value)} placeholder={expected === "student" ? "Scan QR or enter 2026-0001" : "Scan QR or enter DM-001"} autoComplete="off" disabled={disabled} /></label><button className="button button-secondary" type="submit" disabled={disabled || !manual.trim()}>Use code</button></form>
      {cameraError && <p className="scanner-error" role="alert">{cameraError}</p>}
    </section>
  );
}
