package expo.modules.awschime

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.amazonaws.services.chime.sdk.meetings.audiovideo.AttendeeInfo
import com.amazonaws.services.chime.sdk.meetings.audiovideo.AudioVideoObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.SignalUpdate
import com.amazonaws.services.chime.sdk.meetings.audiovideo.VolumeUpdate
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.RemoteVideoSource
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.VideoTileObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.VideoTileState
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.backgroundfilter.backgroundreplacement.BackgroundReplacementConfiguration
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.backgroundfilter.backgroundreplacement.BackgroundReplacementVideoFrameProcessor
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.capture.DefaultCameraCaptureSource
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.capture.DefaultSurfaceTextureCaptureSourceFactory
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.gl.DefaultEglCoreFactory
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.gl.EglCoreFactory
import com.amazonaws.services.chime.sdk.meetings.device.DeviceChangeObserver
import com.amazonaws.services.chime.sdk.meetings.device.MediaDevice
import com.amazonaws.services.chime.sdk.meetings.device.MediaDeviceType
import com.amazonaws.services.chime.sdk.meetings.realtime.RealtimeObserver
import com.amazonaws.services.chime.sdk.meetings.realtime.datamessage.DataMessage
import com.amazonaws.services.chime.sdk.meetings.realtime.datamessage.DataMessageObserver
import com.amazonaws.services.chime.sdk.meetings.session.*
import com.amazonaws.services.chime.sdk.meetings.utils.logger.ConsoleLogger
import com.amazonaws.services.chime.sdk.meetings.utils.logger.LogLevel
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ExpoAWSChimeModule : Module() {
  private val logger = ConsoleLogger(LogLevel.INFO)
  private var meetingSession: MeetingSession? = null
  // True once Chime has already stopped the audio session on its own (class ended,
  // network lost, etc). stopMeeting() must not wait for a "video session stopped"
  // callback that will never come in that case (it would block the main thread).
  @Volatile private var sessionStopped = false
  private val scope = CoroutineScope(Dispatchers.Main)

  // Shared EGL factory: the meeting session AND the custom camera/background
  // pipeline must use the same one (Chime requirement for custom video sources).
  private var eglCoreFactory: EglCoreFactory = DefaultEglCoreFactory()

  // ── Audio routing ──
  // Id of the audio device the student picked manually (null = automatic: prefer
  // Bluetooth > wired/USB headset > speaker > earpiece, re-evaluated on plug/unplug).
  private var userAudioDeviceId: String? = null
  private var deviceObserver: DeviceChangeObserver? = null

  // ── Local video + virtual background ──
  private var localVideoOn = false
  private var videoBackground: String = ""          // "" = none, "1".."7" = assets/live-bg/bg-N.jpg
  private var cameraSource: DefaultCameraCaptureSource? = null
  private var bgProcessor: BackgroundReplacementVideoFrameProcessor? = null

  companion object {
    private const val TAG = "ExpoAWSChimeModule"
    // Must match the desktop app's Chime data-message topics.
    private val DATA_TOPICS = listOf(
      "ck-live-chat", "ck-live-react", "ck-live-msg-react", "ck-live-mod", "ck-live-rec"
    )
  }

  private val reactContext
    get() = requireNotNull(appContext.reactContext)

  private fun defaultUrlRewriter(url: String): String = url

  // ── Audio device helpers ────────────────────────────────────────────────────

  private fun deviceToMap(d: MediaDevice): Map<String, Any?> = mapOf(
    "id" to d.id,
    "label" to d.label,
    "type" to when (d.type) {
      MediaDeviceType.AUDIO_BLUETOOTH -> "bluetooth"
      MediaDeviceType.AUDIO_WIRED_HEADSET -> "wired"
      MediaDeviceType.AUDIO_USB_HEADSET -> "usb"
      MediaDeviceType.AUDIO_BUILTIN_SPEAKER -> "speaker"
      MediaDeviceType.AUDIO_HANDSET -> "earpiece"
      else -> "other"
    }
  )

  private fun audioDevices(): List<MediaDevice> =
    try { meetingSession?.audioVideo?.listAudioDevices() ?: emptyList() } catch (e: Exception) { emptyList() }

  private fun activeAudioDevice(): MediaDevice? =
    try { meetingSession?.audioVideo?.getActiveAudioDevice() } catch (e: Exception) { null }

  // Pick the best available output. If the student chose a device that is still
  // plugged in, keep it; otherwise go by Chime's priority order (lowest first):
  // Bluetooth(0) > wired/USB headset(1) > speaker(2) > earpiece(3).
  private fun routeAudio(devices: List<MediaDevice>) {
    val av = meetingSession?.audioVideo ?: return
    val audio = devices.filter {
      it.type == MediaDeviceType.AUDIO_BLUETOOTH || it.type == MediaDeviceType.AUDIO_WIRED_HEADSET ||
        it.type == MediaDeviceType.AUDIO_USB_HEADSET || it.type == MediaDeviceType.AUDIO_BUILTIN_SPEAKER ||
        it.type == MediaDeviceType.AUDIO_HANDSET
    }
    if (audio.isEmpty()) return
    val picked = userAudioDeviceId?.let { id -> audio.firstOrNull { it.id == id } }
    if (picked == null) userAudioDeviceId = null // chosen device was unplugged → back to automatic
    val target = picked ?: audio.minByOrNull { it.order } ?: return
    try {
      av.chooseAudioDevice(target)
      logger.info(TAG, "Audio routed to ${target.label} (${target.type})")
    } catch (e: Exception) {
      logger.error(TAG, "chooseAudioDevice failed: ${e.message}")
    }
  }

  private fun emitAudioDevices() {
    val devices = audioDevices()
    val active = activeAudioDevice()
    scope.launch {
      sendEvent("onAudioDevicesChanged", mapOf(
        "devices" to devices.map { deviceToMap(it) },
        "activeId" to active?.id
      ))
    }
  }

  // ── Local video helpers ─────────────────────────────────────────────────────

  // Decode a bundled background (assets/live-bg/bg-N.jpg, 1280x720).
  private fun loadBackground(sel: String): Bitmap? = try {
    reactContext.assets.open("live-bg/bg-$sel.jpg").use { BitmapFactory.decodeStream(it) }
  } catch (e: Exception) {
    logger.error(TAG, "Background $sel not found: ${e.message}")
    null
  }

  // Stop whatever local video pipeline is running (built-in camera or custom).
  private fun stopLocalVideoPipeline() {
    try { meetingSession?.audioVideo?.stopLocalVideo() } catch (e: Exception) {}
    val cam = cameraSource
    val proc = bgProcessor
    cameraSource = null
    bgProcessor = null
    try { if (cam != null && proc != null) cam.removeVideoSink(proc) } catch (e: Exception) {}
    try { cam?.stop() } catch (e: Exception) {}
    try { proc?.release() } catch (e: Exception) {}
  }

  // Start local video: plain built-in camera, or camera → background replacement
  // → Chime when a background is selected. Falls back to the plain camera if the
  // background pipeline can't be built. Returns "background" or "plain".
  private fun startLocalVideoPipeline(): String {
    val av = meetingSession?.audioVideo ?: return "plain"
    stopLocalVideoPipeline()

    if (videoBackground.isNotEmpty()) {
      val image = loadBackground(videoBackground)
      if (image != null) {
        try {
          val ctx = reactContext.applicationContext
          val cam = DefaultCameraCaptureSource(
            ctx, logger, DefaultSurfaceTextureCaptureSourceFactory(logger, eglCoreFactory)
          )
          val proc = BackgroundReplacementVideoFrameProcessor(
            logger, eglCoreFactory, ctx, BackgroundReplacementConfiguration(image)
          )
          cam.addVideoSink(proc)
          cam.start()
          av.startLocalVideo(proc)
          cameraSource = cam
          bgProcessor = proc
          return "background"
        } catch (e: Exception) {
          logger.error(TAG, "Background pipeline failed, using plain camera: ${e.message}")
          stopLocalVideoPipeline()
        }
      }
    }
    av.startLocalVideo()
    return "plain"
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoAWSChime")

    Events(
      "onMeetingStart",
      "onMeetingEnd",
      "onAttendeesJoin",
      "onAttendeesLeave",
      "onAttendeesMute",
      "onAttendeesUnmute",
      "onAddVideoTile",
      "onRemoveVideoTile",
      "onVideoTileSizeChanged",
      "onDataMessage",
      "onConnectionState",
      "onAudioDevicesChanged",
      "onError"
    )

    AsyncFunction("startMeeting") { meetingInfo: Map<String, Any>, attendeeInfo: Map<String, Any>, title: String? ->
      try {
        logger.info(TAG, "Starting meeting")

        val meetingId = meetingInfo["MeetingId"]?.toString()
          ?: throw Exception("MeetingId is required")
        meetingInfo["ExternalMeetingId"]?.toString()
          ?: throw Exception("ExternalMeetingId is required")
        meetingInfo["MediaRegion"]?.toString()
          ?: throw Exception("MediaRegion is required")

        @Suppress("UNCHECKED_CAST")
        val mediaPlacement = meetingInfo["MediaPlacement"] as? Map<String, Any>
          ?: throw Exception("MediaPlacement is required")

        val audioFallbackUrl = mediaPlacement["AudioFallbackUrl"]?.toString()
          ?: throw Exception("AudioFallbackUrl is required")
        val audioHostUrl = mediaPlacement["AudioHostUrl"]?.toString()
          ?: throw Exception("AudioHostUrl is required")
        val signalingUrl = mediaPlacement["SignalingUrl"]?.toString()
          ?: throw Exception("SignalingUrl is required")
        val turnControlUrl = mediaPlacement["TurnControlUrl"]?.toString()
          ?: throw Exception("TurnControlUrl is required")

        val attendeeId = attendeeInfo["AttendeeId"]?.toString()
          ?: throw Exception("AttendeeId is required")
        val externalUserId = attendeeInfo["ExternalUserId"]?.toString()
          ?: throw Exception("ExternalUserId is required")
        val joinToken = attendeeInfo["JoinToken"]?.toString()
          ?: throw Exception("JoinToken is required")

        sessionStopped = false
        userAudioDeviceId = null
        localVideoOn = false
        eglCoreFactory = DefaultEglCoreFactory()

        val configuration = MeetingSessionConfiguration(
          meetingId,
          MeetingSessionCredentials(attendeeId, externalUserId, joinToken),
          MeetingSessionURLs(audioFallbackUrl, audioHostUrl, turnControlUrl, signalingUrl, ::defaultUrlRewriter)
        )
        meetingSession = DefaultMeetingSession(configuration, logger, reactContext, eglCoreFactory)
        logger.info(TAG, "Meeting session created")

        meetingSession?.audioVideo?.let { audioVideo ->
          audioVideo.addAudioVideoObserver(object : AudioVideoObserver {
            override fun onAudioSessionStarted(reconnecting: Boolean) {
              logger.info(TAG, "Audio session started (reconnecting=$reconnecting)")
              scope.launch {
                // Route to headset/Bluetooth if connected (audio client is up now —
                // chooseAudioDevice is a no-op before this point).
                routeAudio(audioDevices())
                emitAudioDevices()
                if (!reconnecting) {
                  sendEvent("onMeetingStart", mapOf("timestamp" to System.currentTimeMillis()))
                }
                // Always report "connected" (fresh connect AND auto-reconnect recovery).
                sendEvent("onConnectionState", mapOf("state" to "connected"))
              }
            }

            override fun onAudioSessionStopped(sessionStatus: MeetingSessionStatus) {
              logger.info(TAG, "Audio session stopped with status: ${sessionStatus.statusCode}")
              sessionStopped = true
              LiveClassService.stop(reactContext)
              scope.launch {
                val statusCode = sessionStatus.statusCode?.value ?: 0
                sendEvent("onMeetingEnd", mapOf(
                  "sessionStatus" to statusCode,
                  "timestamp" to System.currentTimeMillis()
                ))
              }
            }

            override fun onAudioSessionCancelledReconnect() {
              scope.launch { sendEvent("onConnectionState", mapOf("state" to "dropped")) }
            }
            override fun onConnectionRecovered() {
              scope.launch { sendEvent("onConnectionState", mapOf("state" to "connected")) }
            }
            override fun onConnectionBecamePoor() {
              scope.launch { sendEvent("onConnectionState", mapOf("state" to "poor")) }
            }
            override fun onVideoSessionStarted(sessionStatus: MeetingSessionStatus) {}
            override fun onVideoSessionStopped(sessionStatus: MeetingSessionStatus) {}
            override fun onAudioSessionDropped() {
              scope.launch { sendEvent("onConnectionState", mapOf("state" to "reconnecting")) }
            }
            override fun onAudioSessionStartedConnecting(reconnecting: Boolean) {
              if (reconnecting) {
                scope.launch { sendEvent("onConnectionState", mapOf("state" to "reconnecting")) }
              }
            }
            override fun onCameraSendAvailabilityUpdated(available: Boolean) {}
            override fun onRemoteVideoSourceAvailable(sources: List<RemoteVideoSource>) {}
            override fun onRemoteVideoSourceUnavailable(sources: List<RemoteVideoSource>) {}
            override fun onVideoSessionStartedConnecting() {}
          })

          // Headset / Bluetooth plugged or unplugged mid-class → re-route + tell JS.
          val obs = object : DeviceChangeObserver {
            override fun onAudioDeviceChanged(freshAudioDeviceList: List<MediaDevice>) {
              logger.info(TAG, "Audio devices changed: $freshAudioDeviceList")
              routeAudio(freshAudioDeviceList)
              emitAudioDevices()
            }
          }
          deviceObserver = obs
          audioVideo.addDeviceChangeObserver(obs)

          // Data messages (chat / reactions / moderation / recording indicator).
          // Same topics + JSON payloads as the desktop app so both interoperate.
          for (topic in DATA_TOPICS) {
            audioVideo.addRealtimeDataMessageObserver(topic, object : DataMessageObserver {
              override fun onDataMessageReceived(dataMessage: DataMessage) {
                if (dataMessage.throttled) return
                sendEvent("onDataMessage", mapOf(
                  "topic" to dataMessage.topic,
                  "text" to dataMessage.text(),
                  "senderAttendeeId" to dataMessage.senderAttendeeId,
                  "senderExternalUserId" to dataMessage.senderExternalUserId,
                  "timestampMs" to dataMessage.timestampMs
                ))
              }
            })
          }

          audioVideo.addRealtimeObserver(object : RealtimeObserver {
            override fun onVolumeChanged(volumeUpdates: Array<VolumeUpdate>) {}
            override fun onSignalStrengthChanged(signalUpdates: Array<SignalUpdate>) {}

            override fun onAttendeesJoined(attendeeInfo: Array<AttendeeInfo>) {
              scope.launch {
                sendEvent("onAttendeesJoin", mapOf(
                  "attendeeIds" to attendeeInfo.map { it.attendeeId },
                  "externalUserIds" to attendeeInfo.map { it.externalUserId }
                ))
              }
            }

            override fun onAttendeesLeft(attendeeInfo: Array<AttendeeInfo>) {
              scope.launch {
                sendEvent("onAttendeesLeave", mapOf(
                  "attendeeIds" to attendeeInfo.map { it.attendeeId },
                  "externalUserIds" to attendeeInfo.map { it.externalUserId }
                ))
              }
            }

            override fun onAttendeesDropped(attendeeInfo: Array<AttendeeInfo>) {
              scope.launch {
                sendEvent("onAttendeesLeave", mapOf(
                  "attendeeIds" to attendeeInfo.map { it.attendeeId },
                  "externalUserIds" to attendeeInfo.map { it.externalUserId }
                ))
              }
            }

            override fun onAttendeesMuted(attendeeInfo: Array<AttendeeInfo>) {
              scope.launch {
                sendEvent("onAttendeesMute", mapOf("attendeeIds" to attendeeInfo.map { it.attendeeId }))
              }
            }

            override fun onAttendeesUnmuted(attendeeInfo: Array<AttendeeInfo>) {
              scope.launch {
                sendEvent("onAttendeesUnmute", mapOf("attendeeIds" to attendeeInfo.map { it.attendeeId }))
              }
            }
          })

          audioVideo.addVideoTileObserver(object : VideoTileObserver {
            override fun onVideoTileAdded(tileState: VideoTileState) {
              scope.launch {
                sendEvent("onAddVideoTile", mapOf(
                  "tileId" to tileState.tileId,
                  "attendeeId" to tileState.attendeeId,
                  "isLocal" to tileState.isLocalTile,
                  "isScreenShare" to tileState.isContent,
                  "pauseState" to tileState.pauseState.ordinal,
                  "videoStreamContentHeight" to tileState.videoStreamContentHeight,
                  "videoStreamContentWidth" to tileState.videoStreamContentWidth
                ))
              }
            }

            override fun onVideoTileRemoved(tileState: VideoTileState) {
              scope.launch {
                sendEvent("onRemoveVideoTile", mapOf(
                  "tileId" to tileState.tileId,
                  "attendeeId" to tileState.attendeeId,
                  "isLocal" to tileState.isLocalTile,
                  "isScreenShare" to tileState.isContent
                ))
              }
            }

            override fun onVideoTilePaused(tileState: VideoTileState) {}
            override fun onVideoTileResumed(tileState: VideoTileState) {}
            // Real stream size (e.g. a 1920x1080 shared screen) so JS can size the
      // view to the same aspect ratio — the renderer crops to the view's shape.
      override fun onVideoTileSizeChanged(tileState: VideoTileState) {
        sendEvent("onVideoTileSizeChanged", mapOf(
          "tileId" to tileState.tileId,
          "isScreenShare" to tileState.isContent,
          "videoStreamContentHeight" to tileState.videoStreamContentHeight,
          "videoStreamContentWidth" to tileState.videoStreamContentWidth
        ))
      }
          })

          // NOTE: audio routing is no longer forced to the loudspeaker. Chime manages
          // the call audio mode itself, and routeAudio() picks headset/Bluetooth when
          // connected (speaker otherwise) once the audio session has started.
          audioVideo.start()
          audioVideo.startRemoteVideo()

          // Keep the class alive when the app goes to the background.
          LiveClassService.start(reactContext, title)
        }

        logger.info(TAG, "Meeting started successfully")
      } catch (e: Exception) {
        logger.error(TAG, "Error starting meeting: ${e.message}")
        LiveClassService.stop(reactContext)
        scope.launch { sendEvent("onError", mapOf("error" to e.message)) }
        throw e
      }
    }

    AsyncFunction("stopMeeting") {
      logger.info(TAG, "Stopping meeting")
      LiveClassService.stop(reactContext)
      localVideoOn = false

      deviceObserver?.let { obs ->
        try { meetingSession?.audioVideo?.removeDeviceChangeObserver(obs) } catch (e: Exception) {}
      }
      deviceObserver = null

      // Nothing to tear down (never started) or Chime already stopped the session
      // itself: just release resources. Avoids a pointless 5s blocking wait.
      if (meetingSession == null || sessionStopped) {
        stopLocalVideoPipeline()
        meetingSession = null
        return@AsyncFunction null
      }

      // Wait for the video session to stop before releasing (avoids a native
      // SIGSEGV when re-joining right after stopping).
      val cleanupCompleted = kotlinx.coroutines.CompletableDeferred<Unit>()
      meetingSession?.audioVideo?.addAudioVideoObserver(object : AudioVideoObserver {
        override fun onVideoSessionStopped(sessionStatus: MeetingSessionStatus) {
          cleanupCompleted.complete(Unit)
        }
        override fun onAudioSessionStarted(reconnecting: Boolean) {}
        override fun onAudioSessionStopped(sessionStatus: MeetingSessionStatus) {}
        override fun onAudioSessionCancelledReconnect() {}
        override fun onConnectionRecovered() {}
        override fun onConnectionBecamePoor() {}
        override fun onVideoSessionStarted(sessionStatus: MeetingSessionStatus) {}
        override fun onAudioSessionDropped() {}
        override fun onAudioSessionStartedConnecting(reconnecting: Boolean) {}
        override fun onCameraSendAvailabilityUpdated(available: Boolean) {}
        override fun onRemoteVideoSourceAvailable(sources: List<RemoteVideoSource>) {}
        override fun onRemoteVideoSourceUnavailable(sources: List<RemoteVideoSource>) {}
        override fun onVideoSessionStartedConnecting() {}
      })

      try {
        stopLocalVideoPipeline()
        meetingSession?.audioVideo?.stop()
        kotlinx.coroutines.runBlocking {
          kotlinx.coroutines.withTimeout(5000) { cleanupCompleted.await() }
        }
      } catch (e: Exception) {
        logger.error(TAG, "Error stopping meeting: ${e.message}")
      }

      meetingSession = null
      return@AsyncFunction null
    }

    // Broadcast a data message to everyone subscribed to `topic` (UTF-8 text, <= 2KB).
    AsyncFunction("sendDataMessage") { topic: String, text: String, lifetimeMs: Int ->
      try {
        meetingSession?.audioVideo?.realtimeSendDataMessage(topic, text, lifetimeMs)
      } catch (e: Exception) {
        logger.error(TAG, "sendDataMessage failed: ${e.message}")
      }
      return@AsyncFunction null
    }

    AsyncFunction("mute") {
      meetingSession?.audioVideo?.realtimeLocalMute()
      return@AsyncFunction null
    }

    AsyncFunction("unmute") {
      meetingSession?.audioVideo?.realtimeLocalUnmute()
      return@AsyncFunction null
    }

    // Returns "background" when the virtual background is applied, else "plain".
    AsyncFunction("startLocalVideo") {
      val mode = startLocalVideoPipeline()
      localVideoOn = true
      return@AsyncFunction mode
    }

    AsyncFunction("stopLocalVideo") {
      stopLocalVideoPipeline()
      localVideoOn = false
      return@AsyncFunction null
    }

    // Select the virtual background ("" = none, "1".."7"). If the camera is on,
    // it is re-applied immediately. Returns the resulting mode ("background" /
    // "plain" / "off" when the camera is off).
    AsyncFunction("setVideoBackground") { sel: String ->
      videoBackground = sel
      if (!localVideoOn) return@AsyncFunction "off"
      return@AsyncFunction startLocalVideoPipeline()
    }

    // ── Audio output selection ──
    AsyncFunction("listAudioDevices") {
      return@AsyncFunction mapOf(
        "devices" to audioDevices().map { deviceToMap(it) },
        "activeId" to activeAudioDevice()?.id
      )
    }

    // Pick an output by id. Pass "" to go back to automatic (headset > speaker).
    AsyncFunction("chooseAudioDevice") { id: String ->
      userAudioDeviceId = id.ifEmpty { null }
      routeAudio(audioDevices())
      emitAudioDevices()
      return@AsyncFunction null
    }

    View(ExpoAWSChimeView::class) {
      Prop("tileId") { view: ExpoAWSChimeView, tileId: Int ->
        meetingSession?.let { session -> view.setTileId(session, tileId) }
      }

      Prop("isLocal") { view: ExpoAWSChimeView, isLocal: Boolean ->
        view.setIsLocal(isLocal)
      }

      // true = show the whole frame (screen share); false = crop to fill (cameras).
      Prop("fit") { view: ExpoAWSChimeView, fit: Boolean ->
        view.setFit(fit)
      }

      OnViewDestroys {
        meetingSession?.let { session -> it.unsetTileId(session) }
      }
    }
  }
}
