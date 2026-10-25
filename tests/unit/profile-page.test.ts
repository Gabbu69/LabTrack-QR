// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ getUser: vi.fn(), requireProfile: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireProfile: state.requireProfile, getAuthContext: async () => ({ emailOtpVerified: false }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: state.getUser } }) }));
vi.mock("@/app/actions/auth", () => ({ updateProfileAction: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import ProfilePage from "@/app/(portal)/profile/page";
beforeEach(() => {
  state.requireProfile.mockResolvedValue({ id: "verified-user", full_name: "Example Student", email: "example@test.invalid", role: "student", status: "active", data_scope: "operational", program: "Saved course" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("renders the verified profile and save controls when the optional provider call fails", async () => {
  state.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, code: "request_timeout" } });
  render(await ProfilePage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "PERSONAL PROFILE" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Your saved course will be kept");
  expect(screen.getByLabelText("Course / Program")).toBeDisabled();
  expect(screen.getByLabelText("Course / Program")).toHaveValue("Saved course");
  expect(screen.getByLabelText("Full name")).toBeEnabled();
  expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
});
it("renders fresh course metadata as editable after the provider recovers", async () => {
  state.getUser.mockResolvedValue({ data: { user: { id: "verified-user", user_metadata: { program: "Fresh course" } } }, error: null });
  render(await ProfilePage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByLabelText("Course / Program")).toBeEnabled();
  expect(screen.getByLabelText("Course / Program")).toHaveValue("Fresh course");
  expect(screen.queryByText(/Your saved course will be kept/)).not.toBeInTheDocument();
});
