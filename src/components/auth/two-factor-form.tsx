"use client";

import { useActionState, useState } from "react";
import { Download, KeyRound, Plus, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { enrollMfaAction, generateRecoveryCodeAction, recoverMfaAction, removeMfaAction, verifyMfaAction } from "@/app/actions/mfa";
import { Notice } from "@/components/feedback/notice";
import type { MfaActionState, MfaFactor } from "@/lib/mfa";

const initialState: MfaActionState = {};

function SavedRecoveryCode({ code, nextPath }: { code: string; nextPath?: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([`LabTrack QR recovery code\n\n${code}\n\nKeep this private. Use once with your password if you lose your authenticator.\nGenerating a new code replaces this one.\n`], { type: "text/plain" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "LabTrack-QR-Recovery-Code.txt"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="mfa-recovery-card" aria-label="Save your recovery code">
    <h2>Save your recovery code</h2><p>Keep it somewhere safe. Use it once if you lose your phone.</p>
    <code className="recovery-code">{code}</code>
    <button type="button" className="button button-secondary" onClick={download}><Download aria-hidden="true" />Download code</button>
    {nextPath && <form action={nextPath} className="form-stack"><label className="recovery-saved"><input type="checkbox" required />I saved my recovery code</label><button className="button button-primary" type="submit">Continue</button></form>}
  </section>;
}

function RecoveryForm() {
  const [state, action, pending] = useActionState(recoverMfaAction, initialState);
  const [code, setCode] = useState("");
  return <details className="mfa-code-help"><summary>Use recovery code</summary><form action={action} className="form-stack">
    <p>Replace your lost authenticator. Sign in again after recovery.</p>
    <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
    <label>Recovery code<input name="recovery_code" type="text" value={code} onChange={event => setCode(event.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="characters" minLength={32} maxLength={64} required /></label>
    <Notice error={state.error} /><button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Recovering…" : "Recover authenticator"}</button>
  </form></details>;
}

function RecoverySettings() {
  const [state, action, pending] = useActionState(generateRecoveryCodeAction, initialState);
  return <section className="mfa-recovery-card"><h2>Recovery code</h2><p>A new code replaces your previous code.</p><Notice error={state.error} />{state.recoveryCode ? <SavedRecoveryCode code={state.recoveryCode} /> : <form action={action}><button className="button button-secondary" disabled={pending}>{pending ? "Creating…" : "Create recovery code"}</button></form>}</section>;
}

export function RecoveryCodeSetup({ nextPath }: { nextPath: "/dashboard" | "/change-password" }) {
  const [state, action, pending] = useActionState(generateRecoveryCodeAction, initialState);
  if (state.recoveryCode) return <SavedRecoveryCode code={state.recoveryCode} nextPath={nextPath} />;
  return <form action={action} className="form-stack"><p className="mfa-help">Create a one-use code in case you lose your phone.</p><Notice error={state.error} /><button className="button button-primary" disabled={pending}>{pending ? "Creating…" : "Create recovery code"}</button></form>;
}

function VerificationForm({ factorId, factors, manage = false }: { factorId?: string; factors?: MfaFactor[]; manage?: boolean }) {
  const [state, action, pending] = useActionState(verifyMfaAction, initialState);
  return (
    <form action={action} className="form-stack mfa-code-form">
      {manage && <input type="hidden" name="manage" value="1" />}
      {factorId ? <input type="hidden" name="factor_id" value={factorId} /> : factors && factors.length > 1 ? (
        <label>Authenticator<select name="factor_id" defaultValue={factors[0].id}>{factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select></label>
      ) : <input type="hidden" name="factor_id" value={factors?.[0]?.id ?? ""} />}
      <label>6-digit code<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required className="mfa-code-input" aria-describedby="mfa-code-help" /></label>
      <p id="mfa-code-help" className="mfa-help">Use the current code from your authenticator app.</p>
      <details className="mfa-code-help"><summary>Where do I find the code?</summary><p>Open Google Authenticator or Microsoft Authenticator on your phone. Select LabTrack QR and enter the six digits shown. If the code changes, use the new code. Set your phone&apos;s date and time to automatic if codes keep failing.</p></details>
      <Notice error={state.error} message={state.message} />
      <button type="submit" className="button button-primary" disabled={pending} data-help-result="Verifies the code with the authentication service. Only a valid code completes sign-in or confirms this authenticator."><ShieldCheck aria-hidden="true" />{pending ? "Verifying..." : factorId ? "Confirm authenticator" : "Verify and continue"}</button>
    </form>
  );
}

function RemoveAuthenticator({ factor }: { factor: MfaFactor }) {
  const [state, action, pending] = useActionState(removeMfaAction, initialState);
  return (
    <div className="mfa-remove">
      <form action={action}>
        <input type="hidden" name="factor_id" value={factor.id} />
        <input type="hidden" name="manage" value="1" />
        <button type="submit" className="mfa-icon-button" disabled={pending} aria-label={`Remove ${factor.name}`} title={`Remove ${factor.name}`} data-help="Remove this authenticator only after verifying another device you can still access." data-help-result="Removes this authenticator from your account. At least one verified authenticator must remain."><Trash2 aria-hidden="true" /></button>
      </form>
      <Notice error={state.error} message={state.message} />
    </div>
  );
}

export function TwoFactorForm({ factors, manage = false }: { factors: MfaFactor[]; manage?: boolean }) {
  const [state, action, pending] = useActionState(enrollMfaAction, initialState);
  const enrollment = state.enrollment;
  if (!manage && factors.length > 0) return <><VerificationForm factors={factors} /><RecoveryForm /></>;

  return (
    <div className="mfa-form-content">
      {manage && (
        <section className="mfa-devices" aria-labelledby="mfa-devices-title">
          <h2 id="mfa-devices-title">Verified authenticators</h2>
          <ul>{factors.map((factor) => (
            <li key={factor.id}><Smartphone aria-hidden="true" /><div><strong>{factor.name}</strong><span>Verified</span></div>{factors.length > 1 && <RemoveAuthenticator factor={factor} />}</li>
          ))}</ul>
          <p className="mfa-help">Keep at least one verified authenticator. Add a backup before replacing your phone.</p>
        </section>
      )}
      {manage && <RecoverySettings />}
      <section className="mfa-enrollment" aria-labelledby={manage ? "mfa-enrollment-title" : undefined} aria-label={manage ? undefined : "Authenticator setup"}>
        {manage && <h2 id="mfa-enrollment-title">Add a backup authenticator</h2>}
        <Notice error={state.error} message={state.message} />
        {enrollment ? (
          <div className="mfa-enrollment-ready">
            <p className="mfa-instruction">Scan this QR in your authenticator app, then enter its six-digit code.</p>
            <div className="mfa-qr"><QRCodeSVG value={enrollment.uri} size={216} level="M" marginSize={4} title="Authenticator setup QR code" /></div>
            <details className="mfa-manual-key"><summary><KeyRound aria-hidden="true" />Manual setup key</summary><p>On the same phone? Add this as a time-based key in your authenticator.</p><code>{enrollment.secret}</code><p>Keep this key private. Anyone with it can generate your codes.</p></details>
            <VerificationForm key={enrollment.factorId} factorId={enrollment.factorId} manage={manage} />
          </div>
        ) : (
          <form action={action} className="form-stack">
            {manage && <input type="hidden" name="manage" value="1" />}
            <div className="mfa-prepare"><Smartphone aria-hidden="true" /><div><strong>{manage ? "Have your backup device ready" : "Have your phone ready"}</strong><p>Open Google Authenticator or Microsoft Authenticator.</p></div></div>
            <label>Authenticator name <small>optional</small><input name="friendly_name" type="text" maxLength={60} placeholder={manage ? "Backup phone" : "My phone"} autoComplete="off" /></label>
            <button type="submit" className="button button-primary" disabled={pending}>{manage ? <Plus aria-hidden="true" /> : <Smartphone aria-hidden="true" />}{pending ? "Preparing setup..." : manage ? "Add authenticator" : "Set up authenticator"}</button>
          </form>
        )}
      </section>
    </div>
  );
}
