// The few Flutter plugin types fitbit-air's Kotlin uses, rebuilt plainly so its plugin class runs unchanged inside
// Halo (a React Native app, no Flutter engine). app.halo.air.AirHost drives it through these: method calls come in as
// MethodCall, answers go out through MethodChannel.Result. The event channels exist but nothing listens on them.
package io.flutter.plugin.common

/** A stand-in for Flutter's messenger: nothing is sent through it. */
interface BinaryMessenger

class MethodCall(@JvmField val method: String, @JvmField val arguments: Any?) {
  @Suppress("UNCHECKED_CAST")
  fun <T> argument(key: String): T? = (arguments as? Map<*, *>)?.get(key) as T?
}

class MethodChannel(@Suppress("UNUSED_PARAMETER") messenger: BinaryMessenger, val name: String) {
  interface Result {
    fun success(result: Any?)
    fun error(code: String, message: String?, details: Any?)
    fun notImplemented()
  }

  fun interface MethodCallHandler {
    fun onMethodCall(call: MethodCall, result: Result)
  }

  var handler: MethodCallHandler? = null
    private set

  fun setMethodCallHandler(handler: MethodCallHandler?) {
    this.handler = handler
  }
}

class EventChannel(@Suppress("UNUSED_PARAMETER") messenger: BinaryMessenger, val name: String) {
  interface EventSink {
    fun success(event: Any?)
    fun error(code: String, message: String?, details: Any?)
    fun endOfStream()
  }

  interface StreamHandler {
    fun onListen(arguments: Any?, events: EventSink)
    fun onCancel(arguments: Any?)
  }

  fun setStreamHandler(@Suppress("UNUSED_PARAMETER") handler: StreamHandler?) {}
}

interface PluginRegistry {
  fun interface RequestPermissionsResultListener {
    fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray): Boolean
  }
}
