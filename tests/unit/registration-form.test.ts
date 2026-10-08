// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const action = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/auth", () => ({ registerFormAction: action }));
import { RegistrationForm } from "@/components/auth/registration-form";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("keeps entered personal details and provides a sign-in link after a duplicate ID error", async () => {
  action.mockResolvedValue({ error: "This Student ID already has an account.", field: "studentId" });
  render(createElement(RegistrationForm, { emailOtpEnabled: false }));
  const name = screen.getByLabelText("Full name");
  const studentId = screen.getByLabelText(/Student ID/);
  fireEvent.change(name, { target: { value: "Test Student" } });
  fireEvent.change(studentId, { target: { value: "ST-100" } });
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "student@example.test" } });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!); });
  expect(screen.getByRole("alert")).toHaveTextContent("Student ID already");
  expect(name).toHaveValue("Test Student");
  expect(studentId).toHaveValue("ST-100");
  expect(studentId).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/login");
  expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
});
