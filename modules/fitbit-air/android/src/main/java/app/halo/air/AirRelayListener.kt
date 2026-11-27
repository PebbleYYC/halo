package app.halo.air

import android.app.Notification
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.util.Calendar

/**
 * Buzzes the Fitbit Air for what the user picked in Settings › Fitbit Air:
 *  - incoming calls (phone, WhatsApp, Signal: any app's ringing call) ring it about every second until the call is
 *    answered, declined or missed, from anyone or only chosen callers, who also ring through quiet hours;
 *  - Halo's own reminders, two pulses;
 *  - chosen apps' messages, one buzz per burst: a flood in a short window is one buzz.
 * Only what would alert the phone counts: not silent, ongoing or summary notifications, not promotions, status,
 * progress or likes, not what Do Not Disturb holds back. Each decision goes in an on-phone log by app and sender name;
 * message text is never read past the sender's name and never stored.
 */
class AirRelayListener : NotificationListenerService() {
  private val main = Handler(Looper.getMainLooper())
  private val alerted = LinkedHashMap<String, Long>()
  private val lastByApp = HashMap<String, Long>()
  private var busy = false
  /** The ringing call's notification key, while the band rings for it. */
  private var ringing: String? = null
  private var ringStarted = 0L

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      handle(sbn)
    } catch (t: Throwable) {
      Log.w(TAG, "relay: ${t.message}")
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    alerted.remove(sbn.key)
    if (sbn.key == ringing) stopRinging()
  }

  override fun onListenerDisconnected() {
    stopRinging()
  }

  private fun handle(sbn: StatusBarNotification) {
    val c = RelayStore.read(applicationContext)
    if (!c.active) return
    val n = sbn.notification
    val now = Calendar.getInstance()
    val quiet = RelayStore.quiet(c, now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE))
    val from = n.extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()

    if (n.category == Notification.CATEGORY_CALL) {
      if (!c.calls) return
      if (!incoming(n)) {
        // Answered (now an ongoing call) or otherwise no longer ringing.
        if (sbn.key == ringing) stopRinging()
        return
      }
      if (sbn.key == ringing) return
      val listed = RelayStore.listed(c, from)
      val why = when {
        c.callers.isNotEmpty() && !listed -> "not a chosen caller"
        quiet && !listed -> "quiet hours"
        else -> null
      }
      log(sbn, from, "call", why)
      if (why == null) startRinging(sbn.key)
      return
    }

    val own = sbn.packageName == packageName
    if (own && !c.halo) return
    if (!own && sbn.packageName !in c.packages) return
    if (sbn.isOngoing || n.flags and Notification.FLAG_GROUP_SUMMARY != 0 || n.flags and Notification.FLAG_FOREGROUND_SERVICE != 0) return
    if (n.category in SKIP) return
    val ranking = Ranking()
    if (currentRanking?.getRanking(sbn.key, ranking) == true) {
      if (ranking.importance < NotificationManager.IMPORTANCE_DEFAULT) return
      if (!ranking.matchesInterruptionFilter()) return log(sbn, from, if (own) "reminder" else "message", "Do Not Disturb")
    }
    // An update the app marked "alert once" doesn't buzz again.
    if (n.flags and Notification.FLAG_ONLY_ALERT_ONCE != 0 && alerted.containsKey(sbn.key)) return
    alerted[sbn.key] = sbn.postTime
    while (alerted.size > 200) alerted.remove(alerted.keys.first())
    val kind = if (own) "reminder" else "message"
    if (quiet) return log(sbn, from, kind, "quiet hours")
    val t = System.currentTimeMillis()
    // One buzz per burst from an app; never over a ringing call.
    if (t - (lastByApp[sbn.packageName] ?: 0L) < BURST_MS) return
    if (ringing != null || busy) return log(sbn, from, kind, "busy")
    lastByApp[sbn.packageName] = t
    busy = true
    log(sbn, from, kind, null)
    AirHost.call(applicationContext, if (own) "vibrate" else "tap", null) { r ->
      busy = false
      r.exceptionOrNull()?.let { Log.w(TAG, "buzz failed: ${it.message}") }
    }
  }

  /** A call that is ringing now: CallStyle's incoming type, or (older dialers) a full-screen ringing notification. */
  private fun incoming(n: Notification): Boolean {
    if (Build.VERSION.SDK_INT >= 31 && n.extras?.containsKey(Notification.EXTRA_CALL_TYPE) == true) {
      return n.extras.getInt(Notification.EXTRA_CALL_TYPE) == Notification.CallStyle.CALL_TYPE_INCOMING
    }
    // A ringing call takes over the screen; an answered one shows its timer instead.
    return n.fullScreenIntent != null && n.extras?.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER) != true
  }

  private fun startRinging(key: String) {
    stopRinging()
    ringing = key
    ringStarted = System.currentTimeMillis()
    AirHost.call(applicationContext, "keepLinkWarm", mapOf("enabled" to true)) { ring(key) }
  }

  /** One pulse, then the next a second after it lands, while this call still rings (a minute at most). */
  private fun ring(key: String) {
    if (ringing != key) return
    if (System.currentTimeMillis() - ringStarted > RING_MAX_MS) return stopRinging()
    AirHost.call(applicationContext, "tap", null) { r ->
      r.exceptionOrNull()?.let { Log.w(TAG, "ring failed: ${it.message}") }
      main.postDelayed({ ring(key) }, RING_GAP_MS)
    }
  }

  private fun stopRinging() {
    if (ringing == null) return
    ringing = null
    // Let Google Health have the band back.
    AirHost.call(applicationContext, "keepLinkWarm", mapOf("enabled" to false)) {}
  }

  private fun log(sbn: StatusBarNotification, from: String, kind: String, why: String?) {
    val app = try {
      val pm = packageManager
      val info = if (Build.VERSION.SDK_INT >= 33) pm.getApplicationInfo(sbn.packageName, PackageManager.ApplicationInfoFlags.of(0))
      else @Suppress("DEPRECATION") pm.getApplicationInfo(sbn.packageName, 0)
      pm.getApplicationLabel(info).toString()
    } catch (_: Throwable) {
      sbn.packageName
    }
    RelayStore.log(applicationContext, RelayEvent(System.currentTimeMillis(), app, from, kind, why == null, why ?: ""))
  }

  companion object {
    private const val TAG = "HaloAirRelay"
    /** Messages from one app inside this window are one buzz. */
    private const val BURST_MS = 15_000L
    private const val RING_GAP_MS = 1_000L
    private const val RING_MAX_MS = 60_000L
    /** Never worth a buzz: promotions, suggestions, status and progress, likes and other social updates. */
    private val SKIP = setOf(
      Notification.CATEGORY_PROMO, Notification.CATEGORY_RECOMMENDATION, Notification.CATEGORY_STATUS,
      Notification.CATEGORY_PROGRESS, Notification.CATEGORY_SOCIAL, Notification.CATEGORY_SERVICE,
      Notification.CATEGORY_SYSTEM, Notification.CATEGORY_TRANSPORT, Notification.CATEGORY_NAVIGATION,
    )
  }
}
