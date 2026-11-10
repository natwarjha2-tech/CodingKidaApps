package expo.modules.awschime

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground service that keeps a live class running while the app is in the
 * background (student switches to YouTube / WhatsApp, locks the screen, etc).
 *
 * Without it, Android freezes/limits a backgrounded app: its network + microphone
 * are cut, Chime's connection drops and the student sees "Connection lost".
 * A foreground service of type "microphone" is the platform-sanctioned way for
 * calling apps (Meet/Zoom/Teams do the same) and shows an ongoing notification
 * ("Live class in progress") that returns to the app when tapped.
 *
 * Started when the meeting starts, stopped when it ends / the student leaves.
 * Pure android.* APIs (no extra dependencies).
 */
class LiveClassService : Service() {

  companion object {
    private const val CHANNEL_ID = "ck_live_class"
    private const val NOTIFICATION_ID = 46021
    const val EXTRA_TITLE = "title"

    fun start(context: Context, title: String?) {
      val intent = Intent(context, LiveClassService::class.java).putExtra(EXTRA_TITLE, title ?: "")
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
        else context.startService(intent)
      } catch (e: Exception) {
        // Never break the meeting if the OS refuses the service (e.g. background-start limits).
        android.util.Log.w("LiveClassService", "start failed: ${e.message}")
      }
    }

    fun stop(context: Context) {
      try {
        context.stopService(Intent(context, LiveClassService::class.java))
      } catch (e: Exception) {
        android.util.Log.w("LiveClassService", "stop failed: ${e.message}")
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() } ?: "Live class"
    val notification = buildNotification(title)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      android.util.Log.w("LiveClassService", "startForeground failed: ${e.message}")
      stopSelf()
    }
    // Don't resurrect a dead class after the process is killed.
    return START_NOT_STICKY
  }

  // Student swiped the app away from recents: the meeting is gone with the process.
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  private fun buildNotification(title: String): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Live class", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shown while you are in a live class"
        setShowBadge(false)
      }
      nm.createNotificationChannel(channel)
    }

    // Tap → bring the app (and the live room) back to the foreground.
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    }
    val pending = launch?.let {
      PendingIntent.getActivity(
        this, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("🔴 Live class in progress")
      .setContentText("$title — tap to return")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_CALL)
      .apply { if (pending != null) setContentIntent(pending) }
      .build()
  }
}
