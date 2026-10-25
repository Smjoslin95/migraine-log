// Low-light palette: no pure white, nothing bright. Built for using mid-attack.
export const C = {
  bg: '#0b0b0d',
  card: '#16161a',
  cardOn: '#22303a',
  border: '#24242a',
  text: '#9a9aa3',
  textHi: '#c4c4ca',
  dim: '#55555c',
  accent: '#4f7a6a',
  caution: '#8a7a3e',
  warning: '#9a6a3a',
  over: '#8e4a4a',
};

export const levelColor = {
  ok: C.accent,
  caution: C.caution,
  warning: C.warning,
  over: C.over,
} as const;
