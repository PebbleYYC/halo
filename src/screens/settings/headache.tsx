// Settings › Headache risk `/settings?s=headache`: on or off, the weather's place (approximate location or a city
// searched once), and the evening alert for a High tomorrow.
import * as React from "react";
import { View } from "react-native";
import { BellRing, CloudRain, MapPin } from "lucide-react-native";
import { askNotificationPermission } from "@/background/notify";
import { useApp } from "@/state/app";
import { updateWeatherSettings, useWeatherSettings } from "@/state/weather";
import { Txt } from "@/ui";
import { searchCities, type CityMatch } from "@/weather/openMeteo";
import { askLocation, locationAccess, type LocationAccess } from "@/weather/place";
import { clearWeather } from "@/weather/sync";
import { CalmInput, useCalm } from "./calmKit";
import { ButtonRow, InfoRow, InsetGroup, RowBox, SwitchRow } from "./list";
import { Segmented } from "./parts";
import { toast } from "./toast";

const SOURCES = [
  { value: "location", label: "Location" },
  { value: "city", label: "City" },
] as const;

export function HeadacheSection() {
  const c = useCalm();
  const app = useApp();
  const s = useWeatherSettings();
  const [access, setAccess] = React.useState<LocationAccess | null>(null);
  const [query, setQuery] = React.useState("");
  const [matches, setMatches] = React.useState<CityMatch[]>([]);
  const [searching, setSearching] = React.useState(false);
  React.useEffect(() => {
    void locationAccess().then(setAccess);
  }, [s.source]);

  // A new place drops the old place's weather, then fetches the new one.
  const refetch = async () => {
    await clearWeather();
    void app.refresh();
  };
  const search = async () => {
    setSearching(true);
    try {
      setMatches(await searchCities(query));
    } catch {
      toast("Couldn’t search. Check your connection.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <InsetGroup footer="Halo combines the weather with your sleep, Recovery, stress and alcohol to estimate your chance of a headache. Only your location rounded to about 10 km, or your city, is sent to Open-Meteo for the weather; no health data leaves your phone.">
        <SwitchRow icon={CloudRain} system="teal" label="Headache risk" value={s.enabled} onChange={(v) => void updateWeatherSettings({ enabled: v }).then(() => (v ? refetch() : clearWeather()))} />
      </InsetGroup>
      {s.enabled && (
        <>
          <InsetGroup title="Weather for" footer={s.source === "location" ? "Approximate location only, rounded to about 10 km. It follows you when you travel." : "Your city never changes unless you choose another."}>
            <RowBox>
              <Segmented accessibilityLabel="Weather for" value={s.source} items={SOURCES} onChange={(v) => void updateWeatherSettings({ source: v }).then(refetch)} />
            </RowBox>
            {s.source === "location" ? (
              access === "granted" ? (
                <InfoRow label="Location" value="Allowed" />
              ) : (
                <ButtonRow
                  label={access === "denied" ? "Location is off: allow it in Android settings" : "Allow approximate location"}
                  onPress={async () => {
                    const a = await askLocation();
                    setAccess(a);
                    if (a === "granted") void refetch();
                  }}
                />
              )
            ) : (
              <View>
                {s.city && <InfoRow label="City" value={s.city.name} />}
                <RowBox gap={8}>
                  <CalmInput value={query} onChangeText={setQuery} placeholder="Search for your city" autoCapitalize="words" returnKeyType="search" onSubmitEditing={() => void search()} accessibilityLabel="Search for your city" />
                </RowBox>
                <ButtonRow label={searching ? "Searching…" : "Search"} busy={searching} disabled={query.trim().length < 2 || searching} onPress={() => void search()} />
                {matches.map((m) => (
                  <ButtonRow
                    key={`${m.lat},${m.lon}`}
                    leading={<MapPin size={18} color={c.sub} />}
                    label={[m.name, m.region, m.country].filter(Boolean).join(", ")}
                    onPress={async () => {
                      await updateWeatherSettings({ city: { name: m.name, lat: m.lat, lon: m.lon } });
                      setMatches([]);
                      setQuery("");
                      toast(`Weather for ${m.name}`);
                      void refetch();
                    }}
                  />
                ))}
              </View>
            )}
          </InsetGroup>
          <InsetGroup footer="After 6 PM, once a day, when tomorrow's forecast puts the risk at High.">
            <SwitchRow
              icon={BellRing}
              system="orange"
              label="Alert me the evening before"
              value={s.notify}
              onChange={async (v) => {
                if (v && (await askNotificationPermission()) !== "granted") return toast("Allow notifications for Halo to get the alert.");
                await updateWeatherSettings({ notify: v });
              }}
            />
          </InsetGroup>
          <Txt size={13} lineHeight={18} style={{ color: c.sub, paddingHorizontal: 20 }}>
            Weather data by Open-Meteo.com (CC BY 4.0).
          </Txt>
        </>
      )}
    </>
  );
}
