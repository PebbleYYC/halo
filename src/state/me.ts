// The person's name and photo, for the greeting on Today and the avatar on every tab. Kept on this phone like the units
// (AsyncStorage), never in the Store, an export or anything sent to an AI provider. The photo is a square JPEG in the
// app's documents folder; the gallery's own photo is never touched.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as React from "react";
import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export const ME_KEY = "halo.me";
export type Me = { name: string | null; photo: string | null };
const EMPTY: Me = { name: null, photo: null };
const SIDE = 512;

let saved: Me | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function parse(raw: string | null): Me {
  try {
    const o = raw ? (JSON.parse(raw) as Partial<Me>) : {};
    return { name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null, photo: typeof o.photo === "string" ? o.photo : null };
  } catch {
    return EMPTY;
  }
}

void AsyncStorage.getItem(ME_KEY)
  .then((raw) => {
    if (saved === undefined) saved = parse(raw);
  })
  .catch(() => {
    if (saved === undefined) saved = EMPTY;
  })
  .finally(emit);

async function write(next: Me) {
  saved = next;
  emit();
  await AsyncStorage.setItem(ME_KEY, JSON.stringify(next)).catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The name and photo; both null until set (and while the first read is in flight). */
export function useMe(): Me {
  return React.useSyncExternalStore(subscribe, () => saved ?? EMPTY);
}

export async function setName(name: string) {
  await write({ ...(saved ?? EMPTY), name: name.trim() || null });
}

function remove(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

export type PhotoPick = "saved" | "cancelled" | "denied" | "failed";

/** The camera or the photo picker, cropped square by the system editor, scaled to 512 px and kept as the avatar. */
export async function pickPhoto(from: "camera" | "library"): Promise<PhotoPick> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false };
  let asset: ImagePicker.ImagePickerAsset | undefined;
  try {
    if (from === "camera") {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return "denied";
    }
    const r = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    asset = r.canceled ? undefined : r.assets?.[0];
    if (!asset) return "cancelled";
    const ctx = ImageManipulator.manipulate(asset.uri);
    const side = Math.min(asset.width, asset.height);
    if (asset.width !== asset.height) ctx.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side });
    if (side > SIDE) ctx.resize({ width: SIDE, height: SIDE });
    const image = await ctx.renderAsync();
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    image.release();
    ctx.release();
    const dest = new File(Paths.document, `avatar-${Date.now()}.jpg`);
    await new File(out.uri).move(dest);
    const old = saved?.photo;
    await write({ ...(saved ?? EMPTY), photo: dest.uri });
    remove(old);
    return "saved";
  } catch (e) {
    console.warn(`[me] photo failed: ${e instanceof Error ? e.name : "error"}`);
    return "failed";
  } finally {
    if (asset?.uri.startsWith(Paths.cache.uri)) remove(asset.uri);
  }
}

export async function removePhoto() {
  const old = saved?.photo;
  await write({ ...(saved ?? EMPTY), photo: null });
  remove(old);
}

/** "Ian" from "Ian Harper": the greeting uses the first name. */
export const firstName = (name: string | null) => name?.split(/\s+/)[0] ?? null;
