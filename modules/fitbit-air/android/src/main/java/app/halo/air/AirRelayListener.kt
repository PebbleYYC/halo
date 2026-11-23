package app.halo.air

import android.app.Notification
import android.app.NotificationManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.util.Calendar

/**
 * Buzzes the Fitbit Air for notifications the user picked in Settings › Fitbit Air: Halo's own reminders (two pulses)
 * and chosen apps (one). Only notifications that would alert on the phone count: not silent or low-importance ones,
 * not ongoing ones, not group summaries, not updates that don't alert again, not what Do Not Disturb holds back, and
 * not inside quiet hours. Buzzes at most one every few seconds. Nothing about a notification is stored or sent.
 */
class AirRelayListener : NotificationListenerService() {
  private val alerted = LinkedHashMap<String, Long>()
  private var lastBuzz = 0L
  private var busy = false

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      handle(sbn)
    } catch (t: Throwable) {
      Log.w(TAG, "relay: ${t.message}")
    }
  }

  private fun handle(sbn: StatusBarNotification) {
    val c = RelayStore.read(applicationContext)
    if (!c.active) return
    val own = sbn.packageName == packageName
    if (own && !c.halo) return
    if (!own && sbn.packageName !in c.packages) return
    val n = sbn.notification
    if (sbn.isOngoing || n.flags and Notification.FLAG_GROUP_SUMMARY != 0 || n.flags and Notification.FLAG_FOREGROUND_SERVICE != 0) return
    val ranking = Ranking()
    if (currentRanking?.getRanking(sbn.key, ranking) == true) {
      if (ranking.importance < NotificationManager.IMPORTANCE_DEFAULT) return
      if (!ranking.matchesInterruptionFilter()) return
    }
    // An update that the app marked "alert once" doesn't buzz again.
    if (n.flags and Notification.FLAG_ONLY_ALERT_ONCE != 0 && alerted.containsKey(sbn.key)) return
    alerted[sbn.key] = sbn.postTime
    while (alerted.size > 200) alerted.remove(alerted.keys.first())
    val now = Calendar.getInstance()
    if (RelayStore.quiet(c, now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE))) return
    val t = System.currentTimeMillis()
    if (busy || t - lastBuzz < COALESCE_MS) return
    busy = true
    lastBuzz = t
    AirHost.call(applicationContext, if (own) "vibrate" else "tap", null) { r ->
      busy = false
      r.exceptionOrNull()?.let { Log.w(TAG, "buzz failed: ${it.message}") }
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    alerted.remove(sbn.key)
  }

  companion object {
    private const val TAG = "HaloAirRelay"
    private const val COALESCE_MS = 8_000L
  }
}
