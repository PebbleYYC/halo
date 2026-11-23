package app.halo.air

import android.content.Context
import android.os.Handler
import android.os.Looper
import dev.airpulse.fitbit_air.FitbitAirPlugin
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * One fitbit-air plugin for the whole process: the app's screens and the notification relay share it, so commands never
 * race for the Air's channel. Calls run on the main thread, where the plugin keeps its state.
 */
object AirHost {
  private val main = Handler(Looper.getMainLooper())
  private var plugin: FitbitAirPlugin? = null
  private var channel: MethodChannel? = null

  class AirError(val code: String, message: String) : Exception(message)

  private fun ensure(context: Context): MethodChannel {
    channel?.let { return it }
    val p = FitbitAirPlugin()
    // The plugin makes its MethodChannel in onAttachedToEngine; the stand-in records the handler it sets.
    p.onAttachedToEngine(FlutterPlugin.FlutterPluginBinding(context.applicationContext, object : BinaryMessenger {}))
    val made = p.methodChannelForHost()
    plugin = p
    channel = made
    return made
  }

  /** Runs one plugin method; `done` gets the result or an AirError, on the main thread. */
  fun call(context: Context, method: String, args: Map<String, Any?>?, done: (Result<Any?>) -> Unit) {
    main.post {
      val handler = try {
        ensure(context).handler
      } catch (t: Throwable) {
        done(Result.failure(AirError("UNAVAILABLE", t.message ?: "The Air transport could not start.")))
        return@post
      }
      if (handler == null) {
        done(Result.failure(AirError("UNAVAILABLE", "The Air transport is not ready.")))
        return@post
      }
      var answered = false
      handler.onMethodCall(MethodCall(method, args ?: emptyMap<String, Any?>()), object : MethodChannel.Result {
        override fun success(result: Any?) {
          if (answered) return
          answered = true
          done(Result.success(result))
        }

        override fun error(code: String, message: String?, details: Any?) {
          if (answered) return
          answered = true
          done(Result.failure(AirError(code, message ?: code)))
        }

        override fun notImplemented() = error("NOT_IMPLEMENTED", "$method is not available.", null)
      })
    }
  }
}
