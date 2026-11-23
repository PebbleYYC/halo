// See io/flutter/plugin/common/Common.kt: a stand-in so fitbit-air's plugin class compiles and runs in Halo.
package io.flutter.embedding.engine.plugins

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger

interface FlutterPlugin {
  fun onAttachedToEngine(binding: FlutterPluginBinding)
  fun onDetachedFromEngine(binding: FlutterPluginBinding)

  class FlutterPluginBinding(val applicationContext: Context, val binaryMessenger: BinaryMessenger)
}
