// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MfaActionState } from "@/lib/mfa";

const actions = vi.hoisted(() => ({ enroll: vi.fn(), verify: vi.fn(), remove: vi.fn() }));
vi.mock("@/app/actions/mfa", () => ({ enrollMfaAction: actions.enroll, verifyMfaAction: actions.verify, removeMfaAction: actions.remove }));
import { TwoFactorForm } from "@/components/auth/two-factor-form";

const first = { id: "550e8400-e29b-41d4-a716-446655440001", name: "My phone" };
const second = { id: "550e8400-e29b-41d4-a716-446655440002", name: "Backup phone" };
const enrollment = { factorId: first.id, secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/Test:dummy?secret=JBSWY3DPEHPK3PXP&issuer=Test" };

beforeEach(() => {
  vi.resetAllMocks();
  actions.enroll.mockResolvedValue({});
  actions.verify.mockResolvedValue({});
  actions.remove.mockResolvedValue({});
});
afterEach(cleanup);

async function submit(button: HTMLElement) {
  await act(async () => { fireEvent.submit(button.closest("form")!); });
}

describe("two-factor UI", () => {
  it("starts enrollment only after an explicit submit", async () => {
    render(createElement(TwoFactorForm, { factors: [] }));
    expect(actions.enroll).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
    const name = screen.getByRole("textbox", { name: /Authenticator name/ });
    expect(name).toHaveAttribute("maxlength", "60");
    fireEvent.change(name, { target: { value: "My phone" } });
    await submit(screen.getByRole("button", { name: "Set up authenticator" }));
    expect(actions.enroll).toHaveBeenCalledOnce();
    const form = actions.enroll.mock.calls[0][1] as FormData;
    expect(form.get("friendly_name")).toBe("My phone");
    expect(form.has("manage")).toBe(false);
  });

  it("renders setup QR and a private manual key without storing them", async () => {
    actions.enroll.mockResolvedValue({ enrollment });
    render(createElement(TwoFactorForm, { factors: [] }));
    await submit(screen.getByRole("button", { name: "Set up authenticator" }));
    expect(screen.getByTitle("Authenticator setup QR code").closest("svg")).toBeInTheDocument();
    const key = screen.getByText(enrollment.secret);
    expect(key.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Keep this key private. Anyone with it can generate your codes.")).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("keeps enrollment available when a confirmation code is rejected", async () => {
    actions.enroll.mockResolvedValue({ enrollment });
    actions.verify.mockResolvedValue({ error: "Code was not accepted." });
    render(createElement(TwoFactorForm, { factors: [] }));
    await submit(screen.getByRole("button", { name: "Set up authenticator" }));
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "123456" } });
    await submit(screen.getByRole("button", { name: "Confirm authenticator" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Code was not accepted.");
    expect(screen.getByText(enrollment.secret)).toBeInTheDocument();
    const form = actions.verify.mock.calls[0][1] as FormData;
    expect(form.get("factor_id")).toBe(first.id);
    expect(form.get("code")).toBe("123456");
    expect(form.has("secret")).toBe(false);
    expect(actions.verify.mock.calls[0][0]).toEqual({});
  });

  it("offers only code verification for an already enrolled account", () => {
    render(createElement(TwoFactorForm, { factors: [first] }));
    const code = screen.getByLabelText("6-digit code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("pattern", "[0-9]{6}");
    expect(code).toHaveAttribute("maxlength", "6");
    expect(screen.queryByRole("button", { name: "Set up authenticator" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Authenticator setup QR code")).not.toBeInTheDocument();
  });

  it("allows choosing a backup authenticator without exposing its secret", async () => {
    render(createElement(TwoFactorForm, { factors: [first, second] }));
    fireEvent.change(screen.getByRole("combobox", { name: "Authenticator" }), { target: { value: second.id } });
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "654321" } });
    await submit(screen.getByRole("button", { name: "Verify and continue" }));
    expect((actions.verify.mock.calls[0][1] as FormData).get("factor_id")).toBe(second.id);
    expect(screen.queryByText(enrollment.secret)).not.toBeInTheDocument();
  });

  it("does not offer removal of the last verified authenticator", () => {
    render(createElement(TwoFactorForm, { factors: [first], manage: true }));
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add authenticator" })).toBeInTheDocument();
  });

  it("sends management intent for adding and removing backup devices", async () => {
    render(createElement(TwoFactorForm, { factors: [first, second], manage: true }));
    await submit(screen.getByRole("button", { name: "Remove Backup phone" }));
    const removal = actions.remove.mock.calls[0][1] as FormData;
    expect(removal.get("factor_id")).toBe(second.id);
    expect(removal.get("manage")).toBe("1");
    await submit(screen.getByRole("button", { name: "Add authenticator" }));
    expect((actions.enroll.mock.calls[0][1] as FormData).get("manage")).toBe("1");
  });

  it("disables enrollment while its action is pending and presents errors", async () => {
    let resolve!: (state: MfaActionState) => void;
    actions.enroll.mockImplementation(() => new Promise<MfaActionState>(done => { resolve = done; }));
    render(createElement(TwoFactorForm, { factors: [] }));
    await submit(screen.getByRole("button", { name: "Set up authenticator" }));
    expect(screen.getByRole("button", { name: "Preparing setup..." })).toBeDisabled();
    await act(async () => { resolve({ error: "Setup is temporarily unavailable." }); });
    expect(screen.getByRole("alert")).toHaveTextContent("Setup is temporarily unavailable.");
    expect(screen.getByRole("button", { name: "Set up authenticator" })).toBeEnabled();
  });
});
