// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/app/actions/auth", () => ({ signOutAction: vi.fn() }));
import { LogoutButton } from "@/components/auth/logout-button";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);
it("asks for confirmation and lets the person stay signed in", () => {
  render(createElement(LogoutButton));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Log Out$/ }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Are you sure you want to log out?");
  expect(screen.getByRole("button", { name: "Yes, log out" })).toHaveAttribute("type", "submit");
  fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
