import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDb } from '../src/db/DbContext';
import {
  addMed, CLASS_LABELS, DEFAULT_LIMITS, deleteMed, listMeds, overuseStatus, recentDoses,
  type DoseRow, type Medication, type MedClass, type OveruseStatus,
} from '../src/db/meds';
import { logDoseWithCheck } from '../src/overuseAlert';
import { C, levelColor } from '../src/theme';

const CLASSES = Object.keys(CLASS_LABELS) as MedClass[];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const LEVEL_TEXT = {
  ok: 'Looking good',
  caution: 'Keep an eye on it',
  warning: 'Getting close',
  over: 'Overuse range',
};

export default function Meds() {
  const db = useDb();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [status, setStatus] = useState<OveruseStatus[]>([]);
  const [doses, setDoses] = useState<DoseRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [cls, setCls] = useState<MedClass>('nsaid');
  const [limit, setLimit] = useState('');

  const load = useCallback(async () => {
    setMeds(await listMeds(db));
    setStatus(await overuseStatus(db));
    setDoses(await recentDoses(db));
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!name.trim()) return;
    const n = parseInt(limit, 10);
    await addMed(db, name, cls, Number.isFinite(n) && n > 0 ? n : undefined);
    setName(''); setLimit(''); setAdding(false);
    load();
  };

  const take = async (m: Medication) => {
    await logDoseWithCheck(db, m);
    load();
  };

  const remove = (m: Medication) =>
    Alert.alert(`Remove ${m.name}?`, 'This also deletes its dose history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteMed(db, m.id); load(); } },
    ]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Overuse meters */}
      <Text style={s.h}>Last 30 days</Text>
      {status.length === 0 ? (
        <Text style={s.sub}>No doses logged yet.</Text>
      ) : (
        status.map((st) => {
          const pct = Math.min(1, st.days / st.limit);
          const color = levelColor[st.level];
          return (
            <View key={st.key} style={s.meter}>
              <View style={s.meterTop}>
                <Text style={s.meterLabel}>{st.label}</Text>
                <Text style={[s.meterVal, { color }]}>{st.days}/{st.limit} days</Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color }]} />
              </View>
              <Text style={[s.sub, { color }]}>{LEVEL_TEXT[st.level]}</Text>
            </View>
          );
        })
      )}
      <Text style={s.fine}>
        Counts days with any dose, not number of pills. Defaults follow standard overuse thresholds: 10 days/month for triptans, opioids and combination meds; 15 for simple painkillers. If your doctor gives you a different limit, set it when adding the med.
      </Text>

      {/* Quick dose */}
      <Text style={s.h}>Took something?</Text>
      <View style={s.grid}>
        {meds.map((m) => (
          <Pressable key={m.id} style={s.medBtn} onPress={() => take(m)} onLongPress={() => remove(m)}>
            <Text style={s.medName}>💊 {m.name}</Text>
            <Text style={s.medSub}>{CLASS_LABELS[m.class].split(' (')[0]} · limit {m.monthly_limit}</Text>
          </Pressable>
        ))}
        <Pressable style={[s.medBtn, s.ghost]} onPress={() => setAdding((v) => !v)}>
          <Text style={s.medName}>{adding ? '× Cancel' : '+ Add med'}</Text>
        </Pressable>
      </View>
      {meds.length > 0 && <Text style={s.fine}>Tap to log a dose now. Long-press to remove a med.</Text>}

      {/* Add form */}
      {adding && (
        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="Name (e.g. Sumatriptan 50mg)"
            placeholderTextColor={C.dim}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <View style={s.grid}>
            {CLASSES.map((c) => (
              <Pressable key={c} onPress={() => setCls(c)} style={[s.chip, cls === c && s.chipOn]}>
                <Text style={[s.chipText, cls === c && s.chipTextOn]}>{CLASS_LABELS[c].split(' (')[0]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={s.input}
            placeholder={`Days/month limit (default ${DEFAULT_LIMITS[cls]})`}
            placeholderTextColor={C.dim}
            keyboardType="number-pad"
            value={limit}
            onChangeText={setLimit}
          />
          <Pressable style={s.saveBtn} onPress={save}>
            <Text style={s.saveText}>Save</Text>
          </Pressable>
        </View>
      )}

      {/* History */}
      {doses.length > 0 && (
        <>
          <Text style={s.h}>Recent doses</Text>
          {doses.map((d) => (
            <View key={d.id} style={s.histRow}>
              <Text style={s.histName}>{d.name}</Text>
              <Text style={s.histTime}>
                {fmt(d.taken_at)}{d.relief_score != null ? ` · relief ${d.relief_score}/10` : ''}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 60, gap: 10 },
  h: { color: C.textHi, fontSize: 17, marginTop: 18 },
  sub: { color: C.dim, fontSize: 13 },
  fine: { color: C.dim, fontSize: 12, lineHeight: 17 },
  meter: { padding: 14, borderRadius: 14, backgroundColor: C.card, gap: 8 },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { color: C.textHi, fontSize: 15 },
  meterVal: { fontSize: 15 },
  track: { height: 8, borderRadius: 4, backgroundColor: C.bg, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, minWidth: 140 },
  ghost: { borderStyle: 'dashed', justifyContent: 'center' },
  medName: { color: C.textHi, fontSize: 15 },
  medSub: { color: C.dim, fontSize: 12, marginTop: 2 },
  form: { padding: 14, borderRadius: 14, backgroundColor: C.card, gap: 12 },
  input: { color: C.textHi, backgroundColor: C.bg, borderRadius: 10, padding: 12, fontSize: 15 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.bg },
  chipOn: { backgroundColor: C.accent },
  chipText: { color: C.text, fontSize: 13 },
  chipTextOn: { color: '#e2e2e6' },
  saveBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveText: { color: '#e2e2e6', fontSize: 16 },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  histName: { color: C.text, fontSize: 14 },
  histTime: { color: C.dim, fontSize: 13 },
});
