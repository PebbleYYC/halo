// A controlled `value` written back mid-composition garbles Android text edited mid-word. The native field owns its
// text here; the value is handed over again only when the app itself changes it (a prefill, a clear), keeping focus.
import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";

export const StableTextInput = React.forwardRef<TextInput, TextInputProps>(function StableTextInput({ value, defaultValue, onChangeText, onFocus, onBlur, ...props }, ref) {
  const inner = React.useRef<TextInput>(null);
  React.useImperativeHandle(ref, () => inner.current as TextInput);
  // What the native field holds, as far as the app knows: its last report, or the value last handed over.
  const typed = React.useRef(value ?? defaultValue ?? "");
  const focused = React.useRef(false);
  const [given, setGiven] = React.useState({ text: value ?? defaultValue ?? "", gen: 0, refocus: false });

  // The app set a different text than the field holds: hand it over (a fresh field with it), focus kept.
  if (value !== undefined && value !== typed.current) {
    typed.current = value;
    setGiven((g) => ({ text: value, gen: g.gen + 1, refocus: focused.current }));
  }

  React.useEffect(() => {
    if (given.refocus) inner.current?.focus();
  }, [given]);

  return (
    <TextInput
      key={given.gen}
      ref={inner}
      defaultValue={given.text}
      onChangeText={(t) => {
        typed.current = t;
        onChangeText?.(t);
      }}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        onBlur?.(e);
      }}
      {...props}
    />
  );
});
