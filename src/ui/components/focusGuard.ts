// Android hands focus back to the last focused text field when the app comes back (and to the first one on a fresh
// window), which opens the keyboard on a screen nobody is typing in. The app lets go of its field on the way out, and
// a field that takes focus right after the app comes to the front, without a touch, gives it straight back.
import { AppState, Keyboard, TextInput } from "react-native";

/** How long after the app comes to the front a focus with no touch behind it counts as Android's, not the person's. */
export const RESTORE_MS = 1500;

let frontAt = Date.now();

AppState.addEventListener("change", (next) => {
  if (next === "active") frontAt = Date.now();
  else {
    TextInput.State.currentlyFocusedInput()?.blur();
    Keyboard.dismiss();
  }
});

/** Whether a focus now, with no touch behind it, is the system restoring focus rather than the person asking. */
export function isRestoredFocus(now = Date.now()): boolean {
  return now - frontAt < RESTORE_MS;
}
