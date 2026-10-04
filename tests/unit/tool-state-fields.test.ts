// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ToolStateFields } from "@/components/forms/tool-state-fields";

afterEach(cleanup);
it.each(["borrowed", "missing"] as const)("keeps %s custody in submitted data while preventing inventory changes to custody or damage", (status) => {
  const view = render(createElement("form", {}, createElement(ToolStateFields, { condition: "good", status })));
  expect(screen.getByRole("combobox", { name: "Status" })).toBeDisabled();
  expect(within(screen.getByRole("combobox", { name: "Status" })).getAllByRole("option")).toHaveLength(1);
  expect(within(screen.getByRole("combobox", { name: "Condition" })).queryByRole("option", { name: "Damaged" })).not.toBeInTheDocument();
  expect(new FormData(view.container.querySelector("form")!).get("status")).toBe(status);
});
it("offers inventory statuses and moves a newly damaged available tool to unavailable", () => {
  render(createElement(ToolStateFields, { condition: "good", status: "available" }));
  const status = screen.getByRole("combobox", { name: "Status" });
  expect(within(status).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["available", "unavailable", "archived"]);
  fireEvent.change(screen.getByRole("combobox", { name: "Condition" }), { target: { value: "damaged" } });
  expect(status).toHaveValue("unavailable");
  expect(within(status).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["unavailable", "archived"]);
  fireEvent.change(screen.getByRole("combobox", { name: "Condition" }), { target: { value: "fair" } });
  expect(status).toHaveValue("unavailable");
  expect(within(status).getByRole("option", { name: "available" })).toBeInTheDocument();
});
