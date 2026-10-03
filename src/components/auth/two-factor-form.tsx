"use client";

import { useActionState } from "react";
import { KeyRound, Plus, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { enrollMfaAction, removeMfaAction, verifyMfaAction } from "@/app/actions/mfa";
import { Notice } from "@/components/feedback/notice";
import type { MfaActionState, MfaFactor } from "@/lib/mfa";

const initialState: MfaActionState = {};

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
      <Notice error={state.error} message={state.message} />
      <button type="submit" className="button button-primary" disabled={pending}><ShieldCheck aria-hidden="true" />{pending ? "Verifying..." : factorId ? "Confirm authenticator" : "Verify and continue"}</button>
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
        <button type="submit" className="mfa-icon-button" disabled={pending} aria-label={`Remove ${factor.name}`} title={`Remove ${factor.name}`}><Trash2 aria-hidden="true" /></button>
      </form>
      <Notice error={state.error} message={state.message} />
    </div>
  );
}

export function TwoFactorForm({ factors, manage = false }: { factors: MfaFactor[]; manage?: boolean }) {
  const [state, action, pending] = useActionState(enrollMfaAction, initialState);
  const enrollment = state.enrollment;
  if (!manage && factors.length > 0) return <VerificationForm factors={factors} />;

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
      <section className="mfa-enrollment" aria-labelledby={manage ? "mfa-enrollment-title" : undefined} aria-label={manage ? undefined : "Authenticator setup"}>
        {manage && <h2 id="mfa-enrollment-title">Add a backup authenticator</h2>}
        <Notice error={state.error} message={state.message} />
        {enrollment ? (
          <div className="mfa-enrollment-ready">
            <p className="mfa-instruction">Scan this QR code with your authenticator app, then enter its 6-digit code.</p>
            <div className="mfa-qr"><QRCodeSVG value={enrollment.uri} size={216} level="M" marginSize={4} title="Authenticator setup QR code" /></div>
            <details className="mfa-manual-key"><summary><KeyRound aria-hidden="true" />Manual setup key</summary><code>{enrollment.secret}</code><p>Keep this key private. Anyone with it can generate your codes.</p></details>
            <VerificationForm key={enrollment.factorId} factorId={enrollment.factorId} manage={manage} />
          </div>
        ) : (
          <form action={action} className="form-stack">
            {manage && <input type="hidden" name="manage" value="1" />}
            <label>Authenticator name <small>optional</small><input name="friendly_name" type="text" maxLength={60} placeholder={manage ? "Backup phone" : "My phone"} autoComplete="off" /></label>
            <button type="submit" className="button button-primary" disabled={pending}>{manage ? <Plus aria-hidden="true" /> : <Smartphone aria-hidden="true" />}{pending ? "Preparing setup..." : manage ? "Add authenticator" : "Set up authenticator"}</button>
          </form>
        )}
      </section>
    </div>
  );
}
