package app.halo.air

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** What the relay buzzes for, kept where the notification listener can read it without the app's JS. */
data class RelayConfig(
  /** Halo's own reminders and alerts. */
  val halo: Boolean = false,
  /** Other apps, by package name: one buzz per burst of messages. */
  val packages: Set<String> = emptySet(),
  /** Quiet hours as minutes of the day; equal means none. */
  val quietStart: Int = 0,
  val quietEnd: Int = 0,
  /** Incoming calls (phone, WhatsApp, Signal…) ring the band until answered or declined. */
  val calls: Boolean = false,
  /** Only these callers ring (matched on the name the call shows); empty means anyone. They also ring in quiet hours. */
  val callers: Set<String> = emptySet(),
) {
  val active get() = halo || packages.isNotEmpty() || calls
}

/** One line of the activity log: who and from which app, never what was said. */
data class RelayEvent(val at: Long, val app: String, val from: String, val kind: String, val buzzed: Boolean, val why: String)

object RelayStore {
  private const val PREFS = "halo_air_relay"
  private const val LOG_MAX = 60

  fun read(context: Context): RelayConfig {
    val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return RelayConfig(
      halo = p.getBoolean("halo", false),
      packages = p.getStringSet("packages", emptySet())?.toSet() ?: emptySet(),
      quietStart = p.getInt("quietStart", 0),
      quietEnd = p.getInt("quietEnd", 0),
      calls = p.getBoolean("calls", false),
      callers = p.getStringSet("callers", emptySet())?.toSet() ?: emptySet(),
    )
  }

  fun write(context: Context, c: RelayConfig) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean("halo", c.halo)
      .putStringSet("packages", c.packages)
      .putInt("quietStart", c.quietStart)
      .putInt("quietEnd", c.quietEnd)
      .putBoolean("calls", c.calls)
      .putStringSet("callers", c.callers)
      .apply()
  }

  /** Inside quiet hours at `minute` of the day (a span may cross midnight). */
  fun quiet(c: RelayConfig, minute: Int): Boolean {
    if (c.quietStart == c.quietEnd) return false
    return if (c.quietStart < c.quietEnd) minute >= c.quietStart && minute < c.quietEnd
    else minute >= c.quietStart || minute < c.quietEnd
  }

  /** Whether `name` (what the call shows) is one of the chosen callers: case and spacing don't matter. */
  fun listed(c: RelayConfig, name: String): Boolean {
    val n = norm(name)
    return n.isNotEmpty() && c.callers.any { norm(it) == n }
  }

  private fun norm(s: String) = s.trim().lowercase().replace(Regex("\\s+"), " ")

  @Synchronized
  fun log(context: Context, e: RelayEvent) {
    val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val arr = try { JSONArray(p.getString("log", "[]")) } catch (_: Exception) { JSONArray() }
    val next = JSONArray()
    next.put(JSONObject().put("at", e.at).put("app", e.app).put("from", e.from.take(40)).put("kind", e.kind).put("buzzed", e.buzzed).put("why", e.why))
    for (i in 0 until minOf(arr.length(), LOG_MAX - 1)) next.put(arr.get(i))
    p.edit().putString("log", next.toString()).apply()
  }

  fun readLog(context: Context): List<Map<String, Any?>> {
    val arr = try { JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("log", "[]")) } catch (_: Exception) { JSONArray() }
    return (0 until arr.length()).map { i ->
      val o = arr.getJSONObject(i)
      mapOf("at" to o.optLong("at"), "app" to o.optString("app"), "from" to o.optString("from"), "kind" to o.optString("kind"), "buzzed" to o.optBoolean("buzzed"), "why" to o.optString("why"))
    }
  }

  fun clearLog(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("log").apply()
  }
}
