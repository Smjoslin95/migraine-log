import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useDb } from '../../src/db/DbContext';
import { deleteAttack, endAttack, getAttack, parseList, updateAttack, type Attack } from '../../src/db/attacks';
import { dosesForAttack, listMeds, setRelief, deleteDose, type DoseRow, type Medication } from '../../src/db/meds';
import { logDoseWithCheck } from '../../src/overuseAlert';
import { Chips } from '../../src/components/Chips';
import { OveruseBanner } from '../../src/components/OveruseBanner';
import { C } from '../../src/theme';

const LOCATIONS = ['Left', 'Right', 'Both sides', 'Forehead', 'Temple', 'Behind eye', 'Back of head', 'Neck'];
const SYMPTOMS = ['Nausea', 'Vomiting', 'Light sensitive', 'Sound sensitive', 'Smell sensitive', 'Dizzy', 'Brain fog', 'Throbbing', 'Pressing', 'Neck pain', 'Fatigue', 'Numbness'];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

export default function AttackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const attackId = Number(id);
  const db = useDb();
  const router = useRouter();

  const [attack, setAttack] = useState<Attack | null>(null);
  const [locations, setLocations] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [meds, setMeds] = useState<Medication[]>([]);
  const [doses, setDoses] = useState<DoseRow[]>([]);
  const [doseTick, setDoseTick] = useState(0);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingNotes = useRef<string | null>(null);

  const load = useCallback(async () => {
    const a = await getAttack(db, attackId);
    if (!a) return;
    setAttack(a);
    setLocations(parseList(a.locations));
    setSymptoms(parseList(a.symptoms));
    setNotes(a.notes ?? '');
    setMeds(await listMeds(db));
    setDoses(await dosesForAttack(db, attackId));
  }, [db, attackId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Leaving the screen mid-typing still saves what you wrote.
  useEffect(() => () => {
    clearTimeout(notesTimer.current);
    if (pendingNotes.current !== null) updateAttack(db, attackId, { notes: pendingNotes.current });
  }, [db, attackId]);

  // Every change saves immediately — no "Save" button to forget mid-attack.
  const patch = async (p: Parameters<typeof updateAttack>[2]) => {
    await updateAttack(db, attackId, p);
    setAttack(await getAttack(db, attackId));
  };

  const onNotes = (t: string) => {
    setNotes(t);
    pendingNotes.current = t;
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      pendingNotes.current = null;
      updateAttack(db, attackId, { notes: t });
    }, 500);
  };

  const takeMed = async (m: Medication) => {
    await logDoseWithCheck(db, m, attackId);
    setDoses(await dosesForAttack(db, attackId));
    setDoseTick((t) => t + 1);
  };

  const rate = async (dose: DoseRow, score: number) => {
    await setRelief(db, dose.id, score);
    Haptics.selectionAsync();
    setDoses(await dosesForAttack(db, attackId));
  };

  const removeDose = (dose: DoseRow) =>
    Alert.alert('Remove this dose?', `${dose.name} at ${fmt(dose.taken_at)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteDose(db, dose.id); await load(); setDoseTick((t) => t + 1); } },
    ]);

  const remove = () =>
    Alert.alert('Delete this attack?', 'Logged doses stay in your medication history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAttack(db, attackId); router.back(); } },
    ]);

  if (!attack) return <View style={s.root} />;

  const durationMin = attack.ended_at
    ? Math.round((+new Date(attack.ended_at) - +new Date(attack.started_at)) / 60000)
    : null;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Time */}
      <Text style={s.meta}>
        Started {fmt(attack.started_at)}
        {attack.ended_at ? ` · ended ${fmt(attack.ended_at)} (${Math.floor(durationMin! / 60)}h ${durationMin! % 60}m)` : ' · ongoing'}
      </Text>
      {!attack.ended_at && (
        <Pressable style={s.endBtn} onPress={async () => { await endAttack(db, attackId); load(); }}>
          <Text style={s.endText}>Mark as over</Text>
        </Pressable>
      )}

      {/* Intensity */}
      <Text style={s.h}>Pain</Text>
      <View style={s.scale}>
        {Array.from({ length: 11 }, (_, n) => (
          <Pressable
            key={n}
            onPress={() => { Haptics.selectionAsync(); patch({ intensity: n }); }}
            style={[s.dot, attack.intensity === n && s.dotOn]}
          >
            <Text style={[s.dotText, attack.intensity === n && s.dotTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>

      {/* Aura */}
      <View style={s.row}>
        <Text style={s.h2}>Aura</Text>
        <Switch
          value={!!attack.aura}
          onValueChange={(v) => patch({ aura: v })}
          trackColor={{ true: C.accent, false: C.card }}
          thumbColor={C.textHi}
        />
      </View>

      {/* Location */}
      <Text style={s.h}>Where</Text>
      <Chips options={LOCATIONS} selected={locations} onChange={(v) => { setLocations(v); patch({ locations: v }); }} />

      {/* Symptoms */}
      <Text style={s.h}>Symptoms</Text>
      <Chips options={SYMPTOMS} selected={symptoms} onChange={(v) => { setSymptoms(v); patch({ symptoms: v }); }} />

      {/* Meds */}
      <Text style={s.h}>Medication</Text>
      <OveruseBanner refreshKey={doseTick} />
      {meds.length === 0 ? (
        <Pressable onPress={() => router.push('/meds')} style={s.ghost}>
          <Text style={s.ghostText}>+ Add your meds first</Text>
        </Pressable>
      ) : (
        <View style={s.medGrid}>
          {meds.map((m) => (
            <Pressable key={m.id} style={s.medBtn} onPress={() => takeMed(m)}>
              <Text style={s.medText}>💊 {m.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {doses.map((d) => (
        <View key={d.id} style={s.dose}>
          <Pressable onLongPress={() => removeDose(d)}>
            <Text style={s.doseTitle}>{d.name} · {fmt(d.taken_at)}</Text>
          </Pressable>
          <Text style={s.sub}>Did it help?</Text>
          <View style={s.reliefRow}>
            {[0, 3, 5, 7, 10].map((n) => (
              <Pressable key={n} onPress={() => rate(d, n)} style={[s.relief, d.relief_score === n && s.dotOn]}>
                <Text style={[s.dotText, d.relief_score === n && s.dotTextOn]}>
                  {n === 0 ? 'No' : n === 10 ? 'Fully' : n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Notes */}
      <Text style={s.h}>Notes</Text>
      <TextInput
        style={s.notes}
        multiline
        value={notes}
        onChangeText={onNotes}
        placeholder="Anything that might be a trigger…"
        placeholderTextColor={C.dim}
      />

      <Pressable onPress={remove} style={s.delete}>
        <Text style={s.deleteText}>Delete attack</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 60, gap: 12 },
  meta: { color: C.text, fontSize: 15 },
  h: { color: C.textHi, fontSize: 17, marginTop: 18 },
  h2: { color: C.textHi, fontSize: 17 },
  sub: { color: C.dim, fontSize: 13, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: C.accent },
  dotText: { color: C.text, fontSize: 15 },
  dotTextOn: { color: '#e2e2e6' },
  endBtn: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.accent },
  endText: { color: '#e2e2e6', fontSize: 15 },
  medGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  medText: { color: C.textHi, fontSize: 15 },
  dose: { padding: 14, borderRadius: 14, backgroundColor: C.card },
  doseTitle: { color: C.textHi, fontSize: 15 },
  reliefRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  relief: { flex: 1, height: 38, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  ghost: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  ghostText: { color: C.text, fontSize: 15 },
  notes: { minHeight: 100, color: C.textHi, backgroundColor: C.card, borderRadius: 14, padding: 14, fontSize: 15, textAlignVertical: 'top' },
  delete: { marginTop: 32, alignSelf: 'center', padding: 12 },
  deleteText: { color: C.over, fontSize: 15 },
});
