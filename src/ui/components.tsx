import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function Button({ label, onPress, kind = 'primary', disabled }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[kind], (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.buttonText, kind === 'secondary' && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text> : null}
      {children}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function Busy() {
  return <ActivityIndicator accessibilityLabel="Loading" style={{ marginVertical: 8 }} />;
}

export const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  rowLabel: { color: '#555', fontSize: 15 },
  rowValue: { color: '#111', fontSize: 15, fontWeight: '500', flexShrink: 1 },
  text: { color: '#222', fontSize: 15 },
  hint: { color: '#666', fontSize: 13 },
  error: { color: '#b00020', fontSize: 15 },
  button: { minHeight: 48, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: '#1b5e20' },
  secondary: { backgroundColor: '#e8eaf0' },
  danger: { backgroundColor: '#b00020' },
  dim: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryText: { color: '#111' },
});
