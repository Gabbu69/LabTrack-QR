// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EmailOtpState } from "@/lib/email-otp";
const actions = vi.hoisted(() => ({ verify: vi.fn(), resend: vi.fn() }));
vi.mock("@/app/actions/email-otp", () => ({ verifyEmailOtpAction: actions.verify, resendEmailOtpAction: actions.resend }));
import { EmailOtpForm } from "@/components/auth/email-otp-form";

beforeEach(() => { vi.resetAllMocks(); actions.verify.mockResolvedValue({}); actions.resend.mockResolvedValue({}); });
afterEach(cleanup);
async function submit(button: HTMLElement) { await act(async () => { fireEvent.submit(button.closest("form")!); }); }

it("accepts a six-digit inbox code without asking for recipient or authenticator secrets", async () => {
  render(createElement(EmailOtpForm));
  const code = screen.getByLabelText("6-digit email code");
  expect(code).toHaveAttribute("autocomplete", "one-time-code");
  expect(code).toHaveAttribute("inputmode", "numeric");
  expect(code).toHaveAttribute("pattern", "[0-9]{6}");
  fireEvent.change(code, { target: { value: "123456" } });
  await submit(screen.getByRole("button", { name: "Verify and continue" }));
  const form = actions.verify.mock.calls[0][1] as FormData;
  expect(form.get("code")).toBe("123456");
  expect(form.has("email")).toBe(false);
  expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
});
it("keeps resend available after a rejected code and displays delivery feedback", async () => {
  actions.verify.mockResolvedValue({ error: "Code expired." });
  actions.resend.mockResolvedValue({ message: "A new code was sent." });
  render(createElement(EmailOtpForm));
  await submit(screen.getByRole("button", { name: "Verify and continue" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Code expired.");
  await submit(screen.getByRole("button", { name: "Resend email code" }));
  expect(screen.getByText("A new code was sent.")).toBeInTheDocument();
});
it("disables both actions while verification is pending", async () => {
  let resolve!: (state: EmailOtpState) => void;
  actions.verify.mockImplementation(() => new Promise<EmailOtpState>(done => { resolve = done; }));
  render(createElement(EmailOtpForm));
  await submit(screen.getByRole("button", { name: "Verify and continue" }));
  expect(screen.getByRole("button", { name: "Verifying..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Resend email code" })).toBeDisabled();
  await act(async () => { resolve({ error: "Try again." }); });
  expect(screen.getByRole("button", { name: "Verify and continue" })).toBeEnabled();
});
