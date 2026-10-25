import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDb } from '../src/db/DbContext';
import { quickLog, endAttack, getOngoing, type Attack } from '../src/db/attacks';
import { OveruseBanner } from '../src/components/OveruseBanner';
import { C } from '../src/theme';

export default function QuickLog() {
  const db = useDb();
  const router = useRouter();
  const [ongoing, setOngoing] = useState<Attack | null>(null);

  const refresh = useCallback(async () => setOngoing(await getOngoing(db)), [db]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const log = async (n: number) => {
    await quickLog(db, n);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const end = async () => {
    if (!ongoing) return;
    await endAttack(db, ongoing.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refresh();
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={s.top}><OveruseBanner compact /></View>

      <View style={s.center}>
        {ongoing ? (
          <>
            <Text style={s.label}>Attack in progress · {ongoing.intensity}/10</Text>
            <Text style={s.sub}>since {new Date(ongoing.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
            <Pressable style={[s.big, { backgroundColor: C.accent }]} onPress={end}>
              <Text style={s.bigText}>It's over</Text>
            </Pressable>
            <Pressable style={s.link} onPress={() => router.push(`/attack/${ongoing.id}`)}>
              <Text style={s.linkText}>Add details or log a med →</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.label}>How bad?</Text>
            <View style={s.grid}>
              {[2, 4, 6, 8, 10].map((n) => (
                <Pressable key={n} style={s.btn} onPress={() => log(n)}>
                  <Text style={s.btnText}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.sub}>One tap logs it. Add details later.</Text>
          </>
        )}
      </View>

      <Pressable style={s.footer} onPress={() => router.push('/meds')}>
        <Text style={s.linkText}>💊 Medications</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 64 },
  top: { minHeight: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { color: C.text, fontSize: 22, marginBottom: 20 },
  sub: { color: C.dim, fontSize: 14, marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  btn: { width: 96, height: 96, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: C.text, fontSize: 32 },
  big: { width: 240, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  bigText: { color: '#d8d8dc', fontSize: 22 },
  link: { marginTop: 20, padding: 12 },
  linkText: { color: C.text, fontSize: 16 },
  footer: { alignSelf: 'center', padding: 16 },
});
