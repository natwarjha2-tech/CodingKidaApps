/**
 * Live Class API client — mobile port of the desktop live*.js REST calls.
 * Mirrors the backend routes under /api/live/classes/* (codingkeda-nextjs).
 *
 * Auth: the shared apiClient auto-attaches the Bearer token (ck_token), so no
 * manual token handling here. Every method returns the parsed JSON body.
 *
 * The backend returns the RAW Amazon Chime `Meeting` and `Attendee` objects on
 * join/start — those feed the native Chime SDK's MeetingSessionConfiguration
 * directly, so we keep them loosely typed (ChimeMeeting / ChimeAttendee).
 */
import { apiClient } from './client';

// ── Types ────────────────────────────────────────────────────────────────────

/** A scheduled/live class (mirrors backend LiveClassDTO). */
export interface LiveClass {
  id: string;
  courseId: string;
  hostUserId: string;
  title: string;
  instructorName: string;
  durationMinutes: number | null;
  agenda: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  mediaRegion: string;
  recordingUrl: string | null;
  createdAt: string;
  /** Present on the list endpoints (enrolled/hosting). */
  courseTitle?: string;
}

/**
 * Raw Amazon Chime Meeting object (from CreateMeeting/GetMeeting). We only type
 * the fields the native SDK needs; the whole object is passed through verbatim.
 */
export interface ChimeMeeting {
  MeetingId: string;
  MediaRegion?: string;
  ExternalMeetingId?: string;
  MediaPlacement?: {
    AudioHostUrl?: string;
    AudioFallbackUrl?: string;
    SignalingUrl?: string;
    TurnControlUrl?: string;
    ScreenDataUrl?: string;
    ScreenViewingUrl?: string;
    ScreenSharingUrl?: string;
    EventIngestionUrl?: string;
  };
  // Allow any extra Chime fields without widening everywhere.
  [key: string]: unknown;
}

/** Raw Amazon Chime Attendee object (from CreateAttendee). */
export interface ChimeAttendee {
  AttendeeId: string;
  ExternalUserId?: string;
  JoinToken: string;
  [key: string]: unknown;
}

/** The join/start payload the native room needs to connect. */
export interface LiveJoinData {
  success: boolean;
  liveClass: LiveClass;
  meeting: ChimeMeeting;
  attendee: ChimeAttendee;
  message?: string;
}

/** One in-room chat message (mirrors backend LiveChatMessageDTO). */
export interface LiveChatMessage {
  id: string;
  liveClassId: string;
  senderId: string;
  senderRole: 'teacher' | 'student' | string;
  senderName: string;
  message: string;
  messageType: string;
  replyToMessageId: string | null;
  createdAt: string;
  isMine?: boolean;
}

/** A participant row (roster). */
export interface LiveParticipant {
  userId: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  joinedAt?: string | null;
  leftAt?: string | null;
  // Host moderation flags (server-derived) — applied on (late) join.
  audioBlocked?: boolean;
  videoBlocked?: boolean;
  chatBlocked?: boolean;
  [key: string]: unknown;
}

/** Host bulk-moderation target. */
export type ModerationType = 'audio' | 'video' | 'chat';

/** A stored recording entry. */
export interface LiveRecording {
  id: string;
  url: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

// Client type sent to the backend on join (for attendance analytics).
export type LiveClientType = 'STUDENT_MOBILE' | 'TEACHER_MOBILE';

// ── API ──────────────────────────────────────────────────────────────────────

export const liveApi = {
  // ── Lists ──
  /** Scheduled + live classes across the student's enrolled courses. */
  getEnrolled: () =>
    apiClient
      .get<{ success: boolean; classes: LiveClass[]; message?: string }>(
        '/api/live/classes/enrolled'
      )
      .then((r) => r.data),

  /** Scheduled + live classes the current user HOSTS (teacher view). */
  getHosting: () =>
    apiClient
      .get<{ success: boolean; classes: LiveClass[]; message?: string }>(
        '/api/live/classes/hosting'
      )
      .then((r) => r.data),

  /** One class by id (host / instructor / enrolled student). */
  getById: (id: string) =>
    apiClient
      .get<{ success: boolean; liveClass?: LiveClass; message?: string } & Partial<LiveClass>>(
        `/api/live/classes/${encodeURIComponent(id)}`
      )
      .then((r) => r.data),

  // ── Lifecycle ──
  /** Teacher: create the Chime meeting + mark the class live. */
  start: (id: string) =>
    apiClient
      .post<{ success: boolean; liveClass: LiveClass; meeting: ChimeMeeting; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/start`,
        {}
      )
      .then((r) => r.data),

  /**
   * Join a live class. Returns { liveClass, meeting, attendee } for the native
   * room. `clientType` is attendance metadata only (identity is derived
   * server-side from the JWT).
   */
  join: (id: string, clientType: LiveClientType = 'STUDENT_MOBILE') =>
    apiClient
      .post<LiveJoinData>(
        `/api/live/classes/${encodeURIComponent(id)}/join`,
        { clientType }
      )
      .then((r) => r.data),

  /** Leave a class (records attendance end). Best-effort. */
  leave: (id: string) =>
    apiClient
      .post<{ success: boolean; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/leave`,
        {}
      )
      .then((r) => r.data)
      .catch(() => ({ success: false as const })),

  /** Teacher: end the class for everyone (stops the Chime meeting). */
  end: (id: string) =>
    apiClient
      .post<{ success: boolean; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/end`,
        {}
      )
      .then((r) => r.data),

  /** Teacher: cancel a scheduled (not-yet-started) class. */
  cancel: (id: string) =>
    apiClient
      .post<{ success: boolean; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/cancel`,
        {}
      )
      .then((r) => r.data),

  // ── Chat ──
  /** Chat history (oldest → newest). `after` (ISO) returns only newer messages. */
  getChat: (id: string, after?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (after) params.append('after', after);
    if (limit) params.append('limit', String(limit));
    const qs = params.toString();
    return apiClient
      .get<{ success: boolean; messages: LiveChatMessage[]; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/chat${qs ? `?${qs}` : ''}`
      )
      .then((r) => r.data);
  },

  /** Persist a chat message. Returns the stored row (with id) to broadcast. */
  sendChat: (id: string, message: string, messageType?: string, replyToMessageId?: string | null) =>
    apiClient
      .post<{ success: boolean; message: LiveChatMessage; error?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/chat`,
        { message, messageType, replyToMessageId }
      )
      .then((r) => r.data),

  /** Toggle a reaction on a message (server handles add/remove). Best-effort. */
  react: (id: string, messageId: string, reaction: string) =>
    apiClient
      .post<{ success: boolean; reacted?: boolean; reaction?: string; messageId?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/reactions`,
        { messageId, reaction }
      )
      .then((r) => r.data)
      .catch(() => ({ success: false as const })),

  // ── Roster ──
  /** Current participants (roster). */
  getParticipants: (id: string) =>
    apiClient
      .get<{ success: boolean; participants: LiveParticipant[]; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/participants`
      )
      .then((r) => r.data)
      .catch(() => ({ success: false as const, participants: [] as LiveParticipant[] })),

  // ── Host moderation ──
  /**
   * Host BULK moderation: enable/disable audio, video, or chat for ALL
   * participants (host excluded). Host/instructor only (enforced server-side).
   */
  moderateAll: (id: string, type: ModerationType, blocked: boolean) =>
    apiClient
      .post<{ success: boolean; type?: ModerationType; blocked?: boolean; count?: number; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/moderate-all`,
        { type, blocked }
      )
      .then((r) => r.data),

  // ── Recording (teacher) ──
  /** Start server-side recording (Chime media pipeline → S3). 503 if not configured. */
  startRecording: (id: string) =>
    apiClient
      .post<{ success: boolean; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/recording/start`,
        {}
      )
      .then((r) => r.data),

  /** Stop server-side recording. */
  stopRecording: (id: string) =>
    apiClient
      .post<{ success: boolean; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/recording/stop`,
        {}
      )
      .then((r) => r.data),

  /** List stored recordings for a class. */
  getRecordings: (id: string) =>
    apiClient
      .get<{ success: boolean; recordings: LiveRecording[]; message?: string }>(
        `/api/live/classes/${encodeURIComponent(id)}/recordings`
      )
      .then((r) => r.data)
      .catch(() => ({ success: false as const, recordings: [] as LiveRecording[] })),
};
