import { EventSubscription, requireOptionalNativeModule } from "expo-modules-core";

import type {
  AttendeeInfo,
  ChimeEventCallback,
  ChimeEventName,
  MeetingInfo,
} from "./ExpoAWSChime.types";

interface ExpoAWSChimeModuleType {
  startMeeting(meetingInfo: MeetingInfo, attendeeInfo: AttendeeInfo): Promise<string>;
  stopMeeting(): Promise<string>;
  sendDataMessage(topic: string, text: string, lifetimeMs: number): Promise<null>;
  mute(): Promise<string>;
  unmute(): Promise<string>;
  startLocalVideo(): Promise<string>;
  stopLocalVideo(): Promise<string>;
  addListener<K extends ChimeEventName>(
    event: K,
    callback: ChimeEventCallback<K>,
  ): EventSubscription;
}

// Optional lookup: if the installed build doesn't contain the native Chime
// module, importing this file must NOT crash the app (a hard require throws at
// import time, which kills a release build). Calls then fail with a clear error.
const NativeChime = requireOptionalNativeModule<ExpoAWSChimeModuleType>("ExpoAWSChime");

const MISSING =
  "Live class module is not available in this app build. Please install the latest app version.";

const ExpoAWSChimeModule: ExpoAWSChimeModuleType =
  NativeChime ??
  (new Proxy({} as ExpoAWSChimeModuleType, {
    get(_t, prop) {
      if (prop === "addListener") {
        // No-op subscription so screens can mount and show the error state.
        return () => ({ remove() {} });
      }
      return () => Promise.reject(new Error(MISSING));
    },
  }) as ExpoAWSChimeModuleType);

export const isChimeAvailable = !!NativeChime;

export async function startMeeting(
  meetingInfo: MeetingInfo,
  attendeeInfo: AttendeeInfo,
): Promise<string> {
  return await ExpoAWSChimeModule.startMeeting(meetingInfo, attendeeInfo);
}

export async function stopMeeting(): Promise<string> {
  return await ExpoAWSChimeModule.stopMeeting();
}

/** Broadcast a UTF-8 text data message (<= 2KB) on a Chime topic. Best-effort. */
export async function sendDataMessage(topic: string, text: string, lifetimeMs = 0): Promise<void> {
  try {
    await ExpoAWSChimeModule.sendDataMessage(topic, text, lifetimeMs);
  } catch {
    /* best-effort: REST remains the source of truth */
  }
}

export async function mute(): Promise<string> {
  return await ExpoAWSChimeModule.mute();
}

export async function unmute(): Promise<string> {
  return await ExpoAWSChimeModule.unmute();
}

export async function startLocalVideo(): Promise<string> {
  return await ExpoAWSChimeModule.startLocalVideo();
}

export async function stopLocalVideo(): Promise<string> {
  return await ExpoAWSChimeModule.stopLocalVideo();
}

export function addListener<K extends ChimeEventName>(event: K, callback: ChimeEventCallback<K>) {
  return ExpoAWSChimeModule.addListener(event, callback);
}
