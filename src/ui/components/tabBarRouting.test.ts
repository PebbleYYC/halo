import { describe, expect, it } from "vitest";
import { activeTabName, hrefOf } from "./tabRouting";

const ROUTES = ["index", "tab-sleep", "tab-activity", "health", "journal", "more"];

describe("tab bar routing from the live path", () => {
  it("maps each tab's path to its route, so the lit tab follows the real screen", () => {
    expect(activeTabName("/", ROUTES)).toBe("index");
    expect(activeTabName("/tab-sleep", ROUTES)).toBe("tab-sleep");
    expect(activeTabName("/tab-activity", ROUTES)).toBe("tab-activity");
    expect(activeTabName("/health", ROUTES)).toBe("health");
  });

  it("maps off-bar tab screens to their own route (the bar then lights their host or none)", () => {
    expect(activeTabName("/journal", ROUTES)).toBe("journal");
    expect(activeTabName("/more", ROUTES)).toBe("more");
  });

  it("returns null for a path that is not one of the bar's tabs, so the bar keeps its handed-in state", () => {
    expect(activeTabName("/day/2026-11-10", ROUTES)).toBeNull();
    expect(activeTabName("/coach", ROUTES)).toBeNull();
  });

  it("turns a route name into its href, index at the root", () => {
    expect(hrefOf("index")).toBe("/");
    expect(hrefOf("tab-activity")).toBe("/tab-activity");
    expect(hrefOf("health")).toBe("/health");
  });
});
