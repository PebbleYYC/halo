// See io/flutter/plugin/common/Common.kt: a stand-in so fitbit-air's plugin class compiles and runs in Halo.
package io.flutter.embedding.engine.plugins.activity

import android.app.Activity
import io.flutter.plugin.common.PluginRegistry

interface ActivityPluginBinding {
  val activity: Activity
  fun addRequestPermissionsResultListener(listener: PluginRegistry.RequestPermissionsResultListener)
  fun removeRequestPermissionsResultListener(listener: PluginRegistry.RequestPermissionsResultListener)
}

interface ActivityAware {
  fun onAttachedToActivity(binding: ActivityPluginBinding)
  fun onDetachedFromActivityForConfigChanges()
  fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding)
  fun onDetachedFromActivity()
}
