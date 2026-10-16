/**
 * expo-aws-chime — vendored AWS Chime SDK native module for Expo (Android).
 *
 * Adapted from the MIT-licensed vintasoftware/expo-chime-demo
 * (https://github.com/vintasoftware/expo-chime-demo), module `expo-aws-chime`.
 * The demo-only pieces (ChimeAPI / useChimeMeeting / getChimeConfig, which fetch
 * from a demo serverless endpoint and require react-native-permissions) were
 * removed — CodingKida gets the Chime Meeting + Attendee from its own backend
 * (liveApi.join) and drives the low-level module functions directly.
 *
 * MIT License — Copyright (c) Vinta Software. See the upstream repo for the full
 * license text.
 */
export {
  startMeeting,
  stopMeeting,
  mute,
  unmute,
  startLocalVideo,
  stopLocalVideo,
  addListener,
} from './src/ExpoAWSChimeModule';
export type {
  AttendeeInfo,
  MeetingInfo,
  VideoTileEvent,
  ChimeEventMap,
  ChimeEventName,
} from './src/ExpoAWSChime.types';
export { default as ExpoAWSChimeView } from './src/ExpoAWSChimeView';
export type { ExpoAWSChimeViewProps } from './src/ExpoAWSChimeView';
