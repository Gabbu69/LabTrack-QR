"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { registerFormAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { PasswordField } from "@/components/forms/password-field";
import { SubmitButton } from "@/components/forms/submit-button";
import type { RegistrationState } from "@/lib/registration";

export function RegistrationForm({ emailOtpEnabled, initialError }: { emailOtpEnabled: boolean; initialError?: string }) {
  const [state, action, pending] = useActionState(registerFormAction, { error: initialError } as RegistrationState);
  const [details, setDetails] = useState({ fullName: "", studentId: "", yearSection: "", groupNumber: "", contactNumber: "", email: "" });
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.error) feedback.current?.focus(); }, [state]);
  const field = (key: keyof typeof details) => ({
    value: details[key], onChange: (event: ChangeEvent<HTMLInputElement>) => setDetails(current => ({ ...current, [key]: event.target.value })),
    "aria-invalid": state.field === key || undefined,
    "aria-describedby": state.field === key ? "registration-feedback" : undefined,
  });
  return <>
    <div id="registration-feedback" ref={feedback} tabIndex={-1}><Notice error={state.error} /></div>
    {state.error && <p className="help-copy">Already registered? <Link href="/login">Go to sign in</Link>. Your details are kept; enter your password again to retry.</p>}
    <form action={action} className="form-grid" aria-busy={pending}>
      <label className="full">Full name<input {...field("fullName")} name="full_name" autoComplete="name" minLength={2} maxLength={120} required /></label>
      <label>Student ID<input {...field("studentId")} name="student_id" minLength={2} maxLength={40} required /><small>Use your own Student ID. Each ID has one active account.</small></label>
      <label>Year / Section<input {...field("yearSection")} name="year_section" placeholder="2nd Year / AMT-A" minLength={2} maxLength={60} required /></label>
      <label>Group number<input {...field("groupNumber")} name="group_number" placeholder="Group 3" maxLength={30} required /></label>
      <label>Contact number<input {...field("contactNumber")} name="contact_number" inputMode="tel" autoComplete="tel" minLength={7} maxLength={30} required /></label>
      <label className="full">Email address<input {...field("email")} name="email" type="email" autoComplete="email" maxLength={254} required /><small>{emailOtpEnabled ? "Use your real Gmail or school email. Your sign-in code will be sent here." : "Use your own Gmail or school email for your LabTrack account."}</small></label>
      <PasswordField className="full" label="Password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required hint="At least 8 characters for registration." />
      <div className="full"><SubmitButton pendingText="Creating your account…">Create account</SubmitButton></div>
    </form>
  </>;
}
