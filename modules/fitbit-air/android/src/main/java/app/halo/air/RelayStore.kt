package app.halo.air

import android.content.Context

/** What the relay buzzes for, kept where the notification listener can read it without the app's JS. */
data class RelayConfig(
  /** Halo's own reminders and alerts. */
  val halo: Boolean = false,
  /** Other apps, by package name. */
  val packages: Set<String> = emptySet(),
  /** Quiet hours as minutes of the day; equal means none. */
  val quietStart: Int = 0,
  val quietEnd: Int = 0,
) {
  val active get() = halo || packages.isNotEmpty()
}

object RelayStore {
  private const val PREFS = "halo_air_relay"

  fun read(context: Context): RelayConfig {
    val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return RelayConfig(
      halo = p.getBoolean("halo", false),
      packages = p.getStringSet("packages", emptySet())?.toSet() ?: emptySet(),
      quietStart = p.getInt("quietStart", 0),
      quietEnd = p.getInt("quietEnd", 0),
    )
  }

  fun write(context: Context, c: RelayConfig) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean("halo", c.halo)
      .putStringSet("packages", c.packages)
      .putInt("quietStart", c.quietStart)
      .putInt("quietEnd", c.quietEnd)
      .apply()
  }

  /** Inside quiet hours at `minute` of the day (a span may cross midnight). */
  fun quiet(c: RelayConfig, minute: Int): Boolean {
    if (c.quietStart == c.quietEnd) return false
    return if (c.quietStart < c.quietEnd) minute >= c.quietStart && minute < c.quietEnd
    else minute >= c.quietStart || minute < c.quietEnd
  }
}
