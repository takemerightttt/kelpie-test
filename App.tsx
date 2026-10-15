import { StatusBar } from 'expo-status-bar';
import { ImportScreen } from '@/features/statement-import/ImportScreen';

export default function App() {
  return (
    <>
      <ImportScreen />
      <StatusBar style="dark" />
    </>
  );
}
