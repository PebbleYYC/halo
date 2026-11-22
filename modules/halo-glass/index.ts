// Halo's Liquid Glass views (android/…/HaloGlassView.kt, HaloGlassTargetView.kt), unwrapped. Use them through
// src/ui/glass.tsx (LiquidGlass, GlassTarget, GlassMaterial), which supplies the target and the theme. Both are null
// where the native module isn't built in (tests, web): glass.tsx then draws a plain translucent fill.
import type * as React from "react";
import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";
import type { ViewProps } from "react-native";

export type NativeGlassProps = ViewProps & {
  /** The react tag of the HaloGlassTargetView to refract; null draws the fallback material. */
  targetId: number | null;
  /** Corner radius in dp; negative for a capsule. */
  cornerRadius: number;
  /** ARGB int from processColor. */
  tintColor: number;
  frost: number;
  refraction: number;
  blurRadius: number;
  saturation: number;
  dark: boolean;
  backdrop: boolean;
};

export type NativeGlassTargetProps = ViewProps & { ref?: React.Ref<unknown> };

const native = requireOptionalNativeModule<{ ignoresBatteryOptimizations?: () => boolean }>("HaloGlass");
const available = native != null;

/** Android exempts Halo from battery optimisation ("Unrestricted"); null where the native module isn't built in. */
export function ignoresBatteryOptimizations(): boolean | null {
  try {
    return native?.ignoresBatteryOptimizations ? native.ignoresBatteryOptimizations() : null;
  } catch {
    return null;
  }
}

export const NativeGlassView: React.ComponentType<NativeGlassProps> | null = available
  ? requireNativeViewManager<NativeGlassProps>("HaloGlass", "HaloGlassView")
  : null;

export const NativeGlassTarget: React.ComponentType<NativeGlassTargetProps> | null = available
  ? requireNativeViewManager<NativeGlassTargetProps>("HaloGlass", "HaloGlassTargetView")
  : null;
