import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C } from '../theme';

type Props = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

// Big, tappable toggle chips — no typing needed mid-attack.
export function Chips({ options, selected, onChange }: Props) {
  const toggle = (o: string) => {
    Haptics.selectionAsync();
    onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  };
  return (
    <View style={s.wrap}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable key={o} onPress={() => toggle(o)} style={[s.chip, on && s.on]}>
            <Text style={[s.text, on && s.textOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  on: { backgroundColor: C.cardOn, borderColor: C.accent },
  text: { color: C.text, fontSize: 15 },
  textOn: { color: C.textHi },
});
