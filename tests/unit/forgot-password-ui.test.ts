// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
const m = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("@/app/actions/forgot-password", () => ({ forgotPasswordAction: m.action }));
beforeEach(() => { m.action.mockReset().mockResolvedValue({ error: "Check your email and authenticator code." }); });
afterEach(cleanup);
it("asks for the authenticator code and new password without requiring the old password", () => {
  render(createElement(ForgotPasswordForm));
  expect(screen.getByLabelText("Authenticator code")).toHaveAttribute("autocomplete", "one-time-code");
  expect(screen.getByLabelText("New password")).toHaveAttribute("autocomplete", "new-password");
  expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
});
it("preserves email and code after a rejected attempt without browser storage", async () => {
  render(createElement(ForgotPasswordForm));
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@test.invalid" } });
  fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPassword123" } });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Reset password" }).closest("form")!); });
  expect(screen.getByRole("alert")).toHaveTextContent("Check your email and authenticator code.");
  expect(screen.getByLabelText("Email address")).toHaveValue("student@test.invalid"); expect(screen.getByLabelText("Authenticator code")).toHaveValue("123456");
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});
