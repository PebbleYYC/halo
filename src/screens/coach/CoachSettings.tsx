// Coach settings `/coach/settings`, ported from Halo's coach/CoachSettings.tsx (Settings › Coach on the web), as an
// iOS settings page: the provider, model and key (as ••••last4 only, with a red Remove key), the person's notes for
// the coach, then Change provider and the two red actions (delete every chat, turn the coach off), each confirmed by
// an alert. With the coach off: its feature header and Set up. The groups rise into place as the page opens.
import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { BotMessageSquare, Trash2 } from "lucide-react-native";
import { MAX_NOTES } from "@/coach/instructions";
import { forget, forgetAll, useFacts } from "@/coach/memory";
import { discover, savedFindings, subscribeFindings, type SavedFindings } from "@/coach/discover";
import { clock } from "@/lib/format";
import { useApp, useQueryCtx } from "@/state/app";
import { providerLabel, providerOf } from "@/coach/providers";
import { useCoachSetup } from "@/coach/session";
import { deleteAllChats, removeProvider, setConsent, setInstructions, type CoachSetup } from "@/coach/storage";
import { useBack } from "@/screens/detail/nav";
import { BottomSheet, DetailShell, Skeleton, Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { RiseEach } from "@/ui/motion/Rise";
import { CalmButton, CalmInput } from "@/screens/settings/calmKit";
import { ButtonRow, HeroCard, InfoRow, InsetGroup, RowBox } from "@/screens/settings/list";
import { toast } from "./ChatList";
import { ProviderForm } from "./CoachSetup";
import { ConfirmDialog } from "./ConfirmDialog";

function Settings({ setup }: { setup: CoachSetup }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | "chats" | "off">(null);
  const [notes, setNotes] = React.useState(setup.instructions ?? "");
  const act = async (p: () => Promise<void>, ok: string, done?: () => void) => {
    setPending(true);
    try {
      await p();
      done?.();
      toast(ok);
    } catch {
      toast("Couldn’t save that on this phone. Try again.");
    } finally {
      setPending(false);
    }
  };
  if (!setup.consent)
    return (
      <View style={{ gap: 24 }}>
        <RiseEach>
          <HeroCard icon={BotMessageSquare} system="indigo" title="Coach" status="Off" body="Set the coach up to ask about your scores, your training and your sleep, with your own AI provider." />
          <CalmButton onPress={() => router.replace("/coach" as Href)}>Set up</CalmButton>
        </RiseEach>
      </View>
    );
  return (
    <View style={{ gap: 24 }}>
      <RiseEach>
        <InsetGroup title="Coach">
          <InfoRow label="Provider" value={setup.provider ? (providerOf(setup.provider)?.label ?? providerLabel(setup.provider)) : "Not set"} />
          {setup.model ? <InfoRow label="Model" value={setup.model} /> : null}
          {setup.last4 ? <InfoRow label="API key" value={`••••${setup.last4}`} numeric /> : null}
          {setup.last4 ? <ButtonRow label="Remove key" danger disabled={pending} onPress={() => void act(removeProvider, "Key removed.")} /> : null}
        </InsetGroup>
        <InsetGroup title="About you" footer="How you’d like the coach to talk and what it should know. It never changes the coach’s safety rules.">
          <RowBox>
            <CalmInput
                value={notes}
                onChangeText={setNotes}
                onBlur={() => notes.trim() !== (setup.instructions ?? "") && void act(() => setInstructions(notes), "Saved.")}
                maxLength={MAX_NOTES}
                multiline
                autoCorrect
                accessibilityLabel="About you"
                placeholder="Short and direct. I lift four days a week and I'm training for a half marathon."
                on="card"
                style={{ minHeight: 96, fontSize: 16, lineHeight: 22 }}
              />
          </RowBox>
        </InsetGroup>
        <PatternsGroup />
        <MemoryGroup />
        <InsetGroup footer="Your key is stored encrypted on this phone and never shown again. It is sent only to your provider.">
          <ButtonRow label={setup.provider ? "Change provider" : "Add key"} onPress={() => setOpen(true)} disabled={pending} />
          <ButtonRow label="Delete all chats" danger disabled={pending} onPress={() => setConfirm("chats")} />
          <ButtonRow label="Turn off coach" danger disabled={pending} onPress={() => setConfirm("off")} />
        </InsetGroup>
      </RiseEach>
      {/* A focused key or model field keeps "Test and save" (under the field's note) in view over the keyboard. */}
      <BottomSheet open={open} onClose={() => setOpen(false)} title="AI provider" size="tall" keyboardGap={112}>
        <ProviderForm
          current={setup}
          onSaved={() => {
            setOpen(false);
            toast("Provider saved.");
          }}
        />
      </BottomSheet>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "chats" ? "Delete every coach chat?" : "Turn the coach off?"}
        description={confirm === "chats" ? "All your saved chats are removed from this phone. This can’t be undone." : "The coach stops until you set it up again. Your key and chats stay; delete them here first if you want them gone."}
        confirm={confirm === "chats" ? "Delete chats" : "Turn off"}
        danger={confirm === "chats"}
        pending={pending}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          void (confirm === "chats" ? act(deleteAllChats, "Every chat deleted.", () => setConfirm(null)) : act(() => setConsent(false), "Coach turned off.", () => setConfirm(null)))
        }
      />
    </View>
  );
}

/**
 * The Coach's daily look for patterns (src/coach/discover.ts): when it last looked, what it compared and what held up,
 * or why it didn't finish, and Look now. So "nothing on Home" can be told apart from "nothing found".
 */
function PatternsGroup() {
  const ctx = useQueryCtx();
  const { timeZone } = useApp();
  const [saved, setSaved] = React.useState<SavedFindings | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const read = () => void savedFindings().then(setSaved);
    read();
    return subscribeFindings(read);
  }, []);
  const st = saved?.stats;
  const when = st ? `${saved?.tried === ctx?.today ? "Today" : (saved?.tried ?? "")} ${clock(st.at, timeZone)}`.trim() : "Not yet";
  const result = saved?.error
    ? `Didn’t finish (${saved.error}). It tries again in a few hours, or tap Look now.`
    : st
      ? st.kept
        ? `${st.kept} ${st.kept === 1 ? "pattern" : "patterns"} on Today, from ${st.tested.toLocaleString("en-US")} comparisons across ${st.variables} measures.`
        : `${st.tested.toLocaleString("en-US")} comparisons across ${st.variables} measures; ${st.cleared} cleared the bar${st.proposed ? `, and none of the Coach’s ${st.proposed} write-ups held up to the numbers` : ""}. Nothing to show yet.`
      : "The Coach looks once a day after a sync.";
  return (
    <InsetGroup title="Patterns" footer="Once a day the Coach compares your nights, days and journal for patterns that are clear in your own data, and puts the best on Today. More logged days, and behaviours like a sport you play, give it more to find.">
      <InfoRow label="Last look" value={when} detail={result} />
      <ButtonRow
        label={busy ? "Looking…" : "Look now"}
        disabled={busy || !ctx}
        busy={busy}
        onPress={() => {
          if (!ctx) return;
          setBusy(true);
          void discover({ ...ctx, now: Math.floor(Date.now() / 1000) }, true).finally(() => setBusy(false));
        }}
      />
    </InsetGroup>
  );
}

/** What the Coach remembers about you, newest first, each with a delete; says so when there's nothing yet. */
function MemoryGroup() {
  const all = useFacts() ?? [];
  return (
    <InsetGroup title="Memory" footer="What the coach keeps between chats, on this phone only. Tell it “remember that…” in a chat, or ask it to forget.">
      {all.length ? (
        [...all].reverse().map((f) => <FactRow key={f.id} text={f.text} onDelete={() => void forget(f.id).then(() => toast("Forgotten."))} />)
      ) : (
        <InfoRow label="Nothing saved yet" value="" />
      )}
      {all.length ? <ButtonRow label="Forget everything" danger onPress={() => void forgetAll().then(() => toast("Memory cleared."))} /> : null}
    </InsetGroup>
  );
}

function FactRow({ text, onDelete }: { text: string; onDelete: () => void }) {
  const c = useCalm();
  return (
    <RowBox style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4, paddingVertical: 6 }}>
      <Txt size={16} lineHeight={21} style={{ flex: 1, minWidth: 0, color: c.ink, paddingVertical: 6 }}>
        {text}
      </Txt>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Forget: ${text}`}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.fill : "transparent" })}
      >
        <Trash2 size={18} color={c.sub} strokeWidth={2} />
      </Pressable>
    </RowBox>
  );
}

export default function CoachSettingsScreen() {
  const onBack = useBack("/coach");
  const setup = useCoachSetup();
  return <DetailShell title="Coach settings" onBack={onBack} primary={setup ? <Settings key={setup.consent ? "on" : "off"} setup={setup} /> : <Skeleton radius={16} style={{ height: 240 }} />} />;
}
