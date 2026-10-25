// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/app/actions/operations", () => ({ deleteUserAction: vi.fn() }));
import { DeleteUserButton } from "@/components/users/delete-user-button";
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);
it("identifies the account, asks for confirmation and supports cancellation without deletion", () => {
  render(createElement(DeleteUserButton, { id: "target", name: "Example Student", email: "example@school.test" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete Example Student" }));
  const dialog = screen.getByRole("dialog", { name: "Delete this user?" });
  expect(dialog).toHaveTextContent("example@school.test"); expect(dialog).toHaveTextContent("cannot be undone");
  expect(dialog.querySelector('[name="profile_id"]')).toHaveValue("target");
  expect(screen.getByRole("button", { name: "Yes, delete user" })).toHaveAttribute("type", "submit");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
