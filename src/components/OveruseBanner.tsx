import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDb } from '../db/DbContext';
import { overuseStatus, type OveruseStatus } from '../db/meds';
import { C, levelColor } from '../theme';

const COPY = {
  caution: (s: OveruseStatus) => `${s.label}: ${s.days} of ${s.limit} days this month`,
  warning: (s: OveruseStatus) => `${s.label}: ${s.limit - s.days} day${s.limit - s.days === 1 ? '' : 's'} left before overuse range`,
  over: (s: OveruseStatus) => `${s.label}: ${s.days} days in 30 — in rebound-headache range. Worth talking to your doctor.`,
};

// Shows the single most urgent overuse status. Hidden when everything is fine.
// Pass a changing `refreshKey` to re-check after logging a dose on the same screen.
export function OveruseBanner({ compact = false, refreshKey = 0 }: { compact?: boolean; refreshKey?: number }) {
  const db = useDb();
  const router = useRouter();
  const [top, setTop] = useState<OveruseStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      overuseStatus(db).then((all) => setTop(all[0] && all[0].level !== 'ok' ? all[0] : null));
    }, [db, refreshKey])
  );

  if (!top || top.level === 'ok') return null;
  const color = levelColor[top.level];

  return (
    <Pressable onPress={() => router.push('/meds')} style={[s.box, { borderColor: color }, compact && s.compact]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.text}>{COPY[top.level](top)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, backgroundColor: C.card, alignSelf: 'stretch' },
  compact: { padding: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { color: C.textHi, fontSize: 14, flex: 1, lineHeight: 20 },
});
