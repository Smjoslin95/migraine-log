import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { SQLiteDatabase } from 'expo-sqlite';
import { logDose, overuseStatus, type Medication, type OveruseLevel } from './db/meds';

const rank: Record<OveruseLevel, number> = { ok: 0, caution: 1, warning: 2, over: 3 };

// Logs a dose and pops an alert only when this dose moves you into a new,
// more serious level — so you're warned once, not nagged on every dose.
export async function logDoseWithCheck(db: SQLiteDatabase, med: Medication, attackId?: number | null) {
  const before = await overuseStatus(db);
  await logDose(db, med.id, attackId);
  const after = await overuseStatus(db);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  // Check the med's own class and the combined "all pain meds" total.
  for (const key of [med.class, 'all-acute']) {
    const prev = before.find((s) => s.key === key)?.level ?? 'ok';
    const now = after.find((s) => s.key === key);
    if (!now || rank[now.level] <= rank[prev]) continue;
    if (now.level !== 'warning' && now.level !== 'over') continue;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const left = now.limit - now.days;
    Alert.alert(
      now.level === 'over' ? 'Overuse range reached' : 'Heads up',
      now.level === 'over'
        ? `That's ${now.days} days of ${now.label.toLowerCase()} in the last 30. Taking these this often can cause rebound headaches. Worth a chat with your doctor about prevention.`
        : `${now.days} of ${now.limit} days used for ${now.label.toLowerCase()} this month. You're ${left} day${left === 1 ? '' : 's'} from the overuse range.`
    );
    break; // one alert at a time
  }
}
