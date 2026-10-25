import { Stack } from 'expo-router';
import { DbProvider } from '../src/db/DbContext';
import { C } from '../src/theme';

export default function Layout() {
  return (
    <DbProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="attack/[id]" options={{ title: 'Attack details' }} />
        <Stack.Screen name="meds" options={{ title: 'Medications' }} />
      </Stack>
    </DbProvider>
  );
}
