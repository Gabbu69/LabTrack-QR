// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordField } from "@/components/forms/password-field";

afterEach(cleanup);

it("shows and hides a password without changing its value or submitting the form", () => {
  const submit = vi.fn(event => event.preventDefault());
  render(createElement("form", { onSubmit: submit }, createElement(PasswordField, { label: "Password", name: "password", defaultValue: "Sample1234", autoComplete: "current-password", required: true })));
  const input = screen.getByLabelText("Password");
  expect(input).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveValue("Sample1234");
  expect(new FormData(input.closest("form")!).get("password")).toBe("Sample1234");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("autocomplete", "current-password");
  expect(submit).not.toHaveBeenCalled();
});

it("toggles new and confirmation passwords independently", () => {
  render(createElement("div", null,
    createElement(PasswordField, { label: "New password", name: "password" }),
    createElement(PasswordField, { label: "Confirm password", name: "confirmation" })));
  fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
  expect(screen.getByLabelText("New password")).toHaveAttribute("type", "text");
  expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
});
