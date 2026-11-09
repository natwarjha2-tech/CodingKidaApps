/**
 * Session-scoped memory of which live classes this student has entered, so the
 * Live list can show "Ongoing" (currently in the room) / "Rejoin" (joined earlier,
 * now left) instead of "Join Now". Mirrors desktop live.js liveMarkJoined /
 * _liveIsCurrentlyInRoom. In-memory only (resets on app restart, like desktop).
 */
const joinedIds = new Set<string>();
let currentRoomId: string | null = null;

export function markLiveJoined(classId: string) {
  if (!classId) return;
  joinedIds.add(classId);
  currentRoomId = classId;
}

export function markLiveLeft(classId: string) {
  if (currentRoomId === classId) currentRoomId = null;
}

export function hasJoinedLive(classId: string): boolean {
  return joinedIds.has(classId);
}

export function isInLiveRoom(classId: string): boolean {
  return currentRoomId === classId;
}
