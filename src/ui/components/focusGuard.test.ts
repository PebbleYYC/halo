import { beforeEach, describe, expect, it, vi } from "vitest";

const listeners: ((s: string) => void)[] = [];
const blur = vi.fn();
const dismiss = vi.fn();
vi.mock("react-native", () => ({
  AppState: { addEventListener: (_: string, fn: (s: string) => void) => listeners.push(fn) },
  Keyboard: { dismiss: () => dismiss() },
  TextInput: { State: { currentlyFocusedInput: () => ({ blur }) } },
}));

const { isRestoredFocus, RESTORE_MS } = await import("./focusGuard");

describe("focusGuard", () => {
  beforeEach(() => {
    blur.mockClear();
    dismiss.mockClear();
  });

  it("lets go of the focused field and the keyboard as the app leaves the front", () => {
    listeners.forEach((fn) => fn("background"));
    expect(blur).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("treats a focus with no touch just after the app comes back as restored, and later ones as the person's", () => {
    const t = Date.now();
    listeners.forEach((fn) => fn("active"));
    expect(isRestoredFocus(t + 200)).toBe(true);
    expect(isRestoredFocus(t + RESTORE_MS + 50)).toBe(false);
  });
});
