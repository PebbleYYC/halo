import { router } from "expo-router";
import { describe, expect, it, vi } from "vitest";
import { isTabRoot, openRoute } from "./openRoute";

vi.mock("expo-router", () => ({ router: { navigate: vi.fn(), push: vi.fn() } }));

describe("openRoute", () => {
  it("navigates to a tab's page, params and all, and pushes anything else", () => {
    expect(isTabRoot("/journal?log=medicine&med=X")).toBe(true);
    expect(isTabRoot("/journal/insights")).toBe(false);
    openRoute("/journal?log=medicine");
    expect(router.navigate).toHaveBeenCalledWith("/journal?log=medicine");
    openRoute("/settings?s=source");
    expect(router.push).toHaveBeenCalledWith("/settings?s=source");
  });
});
