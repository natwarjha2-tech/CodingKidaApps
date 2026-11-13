package expo.modules.awschime

import android.content.Context
import android.view.ViewGroup
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.DefaultVideoRenderView
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.VideoScalingType
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.gl.EglCoreFactory
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.gl.DefaultEglCoreFactory
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSession
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import com.amazonaws.services.chime.sdk.meetings.utils.logger.ConsoleLogger
import com.amazonaws.services.chime.sdk.meetings.utils.logger.LogLevel

class ExpoAWSChimeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var tileId: Int? = null
  private val logger = ConsoleLogger(LogLevel.INFO)
  private var isLocalTile: Boolean = false

  companion object {
    private const val TAG = "ExpoAWSChimeView"
    // Which view currently owns each tile. When the JS layout changes, a NEW
    // view can bind a tile before the OLD view is destroyed; the old view must
    // then NOT unbind (that would leave the new view black).
    private val owners = mutableMapOf<Int, ExpoAWSChimeView>()
  }

  private val reactContext
    get() = requireNotNull(appContext.reactContext)

  internal val videoView = DefaultVideoRenderView(reactContext).also {
    logger.info(TAG, "Creating video view for ExpoAWSChimeView")
    addView(
      it,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    )
    logger.info(TAG, "Video view created and added to ExpoAWSChimeView")
  }

  fun setIsLocal(isLocal: Boolean) {
    logger.info(TAG, "Setting isLocal to $isLocal for tile $tileId")
    this.isLocalTile = isLocal
    // Ensure local video is on top of other views
    videoView.setZOrderMediaOverlay(isLocal)
    logger.info(TAG, "Set isLocal to $isLocal for tile $tileId")
  }

  // AspectFill (SDK default) crops the frame to fill the view; AspectFit shows
  // the whole frame (letterboxed). Screen share must use fit so nothing is cut off.
  fun setFit(fit: Boolean) {
    videoView.scalingType = if (fit) VideoScalingType.AspectFit else VideoScalingType.AspectFill
    videoView.requestLayout()
  }

  fun setTileId(meetingSession: MeetingSession, tileId: Int) {
    logger.info(TAG, "Binding video view to tile $tileId")
    this.tileId = tileId
    owners[tileId] = this
    meetingSession.audioVideo.bindVideoView(videoView, tileId)
    logger.info(TAG, "Successfully bound video view to tile $tileId")
  }

  fun unsetTileId(meetingSession: MeetingSession) {
    val currentTileId = tileId
    if (currentTileId != null) {
      if (owners[currentTileId] !== this) {
        // Another view took this tile over; leave its binding alone.
        logger.info(TAG, "Tile $currentTileId owned by another view; skip unbind")
        this.tileId = null
        this.isLocalTile = false
        return
      }
      owners.remove(currentTileId)
      logger.info(TAG, "Unbinding video view from tile $currentTileId")
      meetingSession.audioVideo.unbindVideoView(currentTileId)
      this.tileId = null
      this.isLocalTile = false
      logger.info(TAG, "Successfully unbound video view from tile $currentTileId")
    }
  }
}
