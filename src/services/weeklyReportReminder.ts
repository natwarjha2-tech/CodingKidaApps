/**
 * Optional Sunday-evening reminder: "Send this week's report to your parents".
 * A local notification on the phone (no server, no cost). Off by default; the
 * student turns it on from My Report.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ck_weekly_report_reminder_id';
export const WEEKLY_REPORT_REMINDER_TYPE = 'weekly_report_reminder';

export async function isWeeklyReminderOn(): Promise<boolean> {
  try { return !!(await AsyncStorage.getItem(KEY)); } catch { return false; }
}

export async function disableWeeklyReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(KEY);
    if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/** Returns false if the student refused the notification permission. */
export async function enableWeeklyReminder(): Promise<boolean> {
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;

  await disableWeeklyReminder(); // never schedule twice
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📊 This week’s report is ready',
      body: 'Send your learning report to your parents on WhatsApp — they will love it!',
      data: { type: WEEKLY_REPORT_REMINDER_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday (1 = Sunday … 7 = Saturday)
      hour: 18,
      minute: 0,
    },
  });
  await AsyncStorage.setItem(KEY, id);
  return true;
}
