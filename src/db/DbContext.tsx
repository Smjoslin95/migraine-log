import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDb } from './schema';
import { C } from '../theme';

const DbCtx = createContext<SQLiteDatabase | null>(null);

// Opens the database once and shares it with every screen.
export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  useEffect(() => { openDb().then(setDb); }, []);

  if (!db) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.dim} />
      </View>
    );
  }
  return <DbCtx.Provider value={db}>{children}</DbCtx.Provider>;
}

export function useDb() {
  const db = useContext(DbCtx);
  if (!db) throw new Error('useDb must be used inside DbProvider');
  return db;
}
