# Migraine Log

A private, local-first migraine tracker built for logging mid-attack.

## What's here (v0.2)
- `app/index.tsx` — dark one-tap quick log, overuse banner, links to details + meds
- `app/attack/[id].tsx` — attack details: pain 0–10, aura, location + symptom chips, med logging with "did it help?" rating, autosaving notes
- `app/meds.tsx` — medication list, one-tap dose logging, 30-day overuse meters, dose history
- `src/db/meds.ts` — overuse logic: counts treatment *days* per class over 30 days (10/month triptans, opioids, combination; 15/month simple painkillers; plus a combined total), with per-med custom limits
- `src/overuseAlert.ts` — alerts once when a dose moves you into "getting close" or "overuse range"
- `src/db/schema.ts` — SQLite schema with versioned migrations

## Run it
```bash
npm install
npx expo install --fix     # pins compatible versions for your Expo SDK
npx expo start             # scan the QR with Expo Go on your phone
```

## Ship it
```bash
npm install -g eas-cli
eas login
eas build:configure
npm run build:ios          # cloud build, no Mac required
npm run submit:ios         # uploads to App Store Connect / TestFlight
npm run build:android
npm run submit:android     # uploads to Google Play Console
```

## Next up
1. ~~Attack detail screen~~ ✅
2. ~~Medication tracker + overuse alerts~~ ✅
3. History calendar
4. Health data sync (HealthKit / Health Connect) for sleep + HRV
5. Shift-aware sleep + barometric pressure
6. Doctor-ready PDF export
