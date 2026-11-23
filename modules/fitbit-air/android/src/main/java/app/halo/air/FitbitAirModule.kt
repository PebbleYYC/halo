package app.halo.air

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Halo's bridge to the Fitbit Air (fitbit-air's plugin through AirHost) and to its notification relay. */
class FitbitAirModule : Module() {
  private val context get() = appContext.reactContext ?: throw CodedException("NO_CONTEXT", "No Android context.", null)

  override fun definition() = ModuleDefinition {
    Name("FitbitAir")

    // One plugin method: isAirPaired, isAirConnected, readBattery, getHapticIntensity, setHapticIntensity, tap, vibrate.
    AsyncFunction("call") { method: String, args: Map<String, Any?>?, promise: Promise ->
      // Ints arrive from JS as doubles; the plugin reads intensity as an Int.
      val fixed = args?.mapValues { (_, v) -> if (v is Double && v % 1.0 == 0.0) v.toInt() else v }
      AirHost.call(context, method, fixed) { r ->
        r.fold(
          { promise.resolve(it) },
          { e -> promise.reject(if (e is AirHost.AirError) e.code else "AIR", e.message ?: "Fitbit Air failed.", e) },
        )
      }
    }

    Function("relayConfig") {
      val c = RelayStore.read(context)
      mapOf("halo" to c.halo, "packages" to c.packages.toList(), "quietStart" to c.quietStart, "quietEnd" to c.quietEnd)
    }

    Function("setRelayConfig") { halo: Boolean, packages: List<String>, quietStart: Int, quietEnd: Int ->
      RelayStore.write(context, RelayConfig(halo, packages.toSet(), quietStart, quietEnd))
    }

    Function("hasNotificationAccess") {
      val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      val me = ComponentName(context, AirRelayListener::class.java)
      flat.split(":").any { ComponentName.unflattenFromString(it) == me }
    }

    Function("openNotificationAccess") {
      val ctx = context
      val component = ComponentName(ctx, AirRelayListener::class.java).flattenToString()
      val detail = Intent("android.settings.NOTIFICATION_LISTENER_DETAIL_SETTINGS")
        .putExtra("android.provider.extra.NOTIFICATION_LISTENER_COMPONENT_NAME", component)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        ctx.startActivity(detail)
      } catch (_: Exception) {
        ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    // Launchable apps, for picking which ones buzz the Air: name and package, by name.
    AsyncFunction("apps") {
      val pm = context.packageManager
      val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val found = if (android.os.Build.VERSION.SDK_INT >= 33) pm.queryIntentActivities(main, PackageManager.ResolveInfoFlags.of(0))
      else @Suppress("DEPRECATION") pm.queryIntentActivities(main, 0)
      found.map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        .filter { it.first != context.packageName }
        .distinctBy { it.first }
        .sortedBy { it.second.lowercase() }
        .map { mapOf("package" to it.first, "label" to it.second) }
    }
  }
}
