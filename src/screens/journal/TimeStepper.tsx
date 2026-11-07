// When an entry happened, set with two steppers instead of typing "YYYY-MM-DD HH:mm": the day (Today, Yesterday,
// Nov 3) and the time, 15 minutes a step, with Now to come back. The value stays the form's wall-clock string.
import * as React from "react";
import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight, Minus, Plus, type LucideIcon } from "lucide-react-native";
import { Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { haptic } from "@/ui/motion/haptics";
import { wallNow } from "./forms";
import { dayWord, parseClock, wallMinutes, wallOf } from "./wallTime";
import { StableTextInput } from "@/ui/components/StableTextInput";
import { font } from "@/ui/fonts";

function Round({ icon: Icon, label, disabled, onPress }: { icon: LucideIcon; label: string; disabled?: boolean; onPress: () => void }) {
  const c = useCalm();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: c.fill, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Icon size={18} color={c.teal} strokeWidth={2.6} />
    </Pressable>
  );
}

export function TimeStepper({ value, onChange, timeZone, label = "Time" }: { value: string; onChange: (v: string) => void; timeZone: string; label?: string }) {
  const c = useCalm();
  const now = wallNow(timeZone);
  const at = wallMinutes(value) ?? wallMinutes(now)!;
  const nowMin = wallMinutes(now)!;
  // A year back at most, as the journal takes; never ahead of now.
  const shift = (d: number) => onChange(wallOf(Math.max(nowMin - 365 * 1440, Math.min(nowMin, at + d))));
  const isNow = Math.abs(nowMin - at) < 1;
  const shown = wallOf(at);
  const day = dayWord(shown, now);
  const [typing, setTyping] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  // A typed time on the shown day; one still ahead of now (or not a time) leaves it as it was.
  const commit = () => {
    if (!typing) return;
    setTyping(false);
    const t = parseClock(draft);
    if (!t) return;
    const next = wallMinutes(`${shown.slice(0, 10)} ${t}`);
    if (next !== null && next <= nowMin) onChange(wallOf(next));
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Txt size={13} lineHeight={18} weight={600} style={{ color: c.sub, letterSpacing: 0.2 }}>
          {label.toUpperCase()}
        </Txt>
        {!isNow && (
          <Pressable onPress={() => onChange(now)} accessibilityRole="button" accessibilityLabel="Set to now" hitSlop={8}>
            <Txt size={15} lineHeight={20} style={{ color: c.teal }}>
              Now
            </Txt>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Round icon={ChevronLeft} label="A day earlier" disabled={at - 1440 < nowMin - 365 * 1440} onPress={() => shift(-1440)} />
        <Txt size={17} lineHeight={22} weight={600} align="center" accessibilityLabel={`${day}`} style={{ color: c.ink, flex: 1 }}>
          {day}
        </Txt>
        <Round icon={ChevronRight} label="A day later" disabled={at + 1440 > nowMin} onPress={() => shift(1440)} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Round icon={Minus} label="15 minutes earlier" onPress={() => shift(-15)} />
        {typing ? (
          <StableTextInput
            autoFocus
            defaultValue={shown.slice(11)}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            onBlur={commit}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            selectTextOnFocus
            maxLength={8}
            accessibilityLabel="Time taken, as 21:40 or 9:40 pm"
            placeholder="21:40"
            placeholderTextColor={c.tertiary}
            style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: c.teal, color: c.ink, fontSize: 22, textAlign: "center", fontVariant: ["tabular-nums"], ...font.numeric(600), paddingVertical: 0 }}
          />
        ) : (
          // Tap the time to type it.
          <Pressable
            onPress={() => {
              setDraft(shown.slice(11));
              setTyping(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`At ${shown.slice(11)}. Type a time`}
            style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 12, backgroundColor: c.fill, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Txt size={22} lineHeight={28} weight={600} align="center" style={{ color: c.ink, fontVariant: ["tabular-nums"] }}>
              {shown.slice(11)}
            </Txt>
          </Pressable>
        )}
        <Round icon={Plus} label="15 minutes later" disabled={at + 15 > nowMin} onPress={() => shift(15)} />
      </View>
    </View>
  );
}
