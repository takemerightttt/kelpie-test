import { StatusBar } from 'expo-status-bar';
import { ImportScreen } from './src/ui/ImportScreen';

export default function App() {
  return (
    <>
      <ImportScreen />
      <StatusBar style="dark" />
    </>
  );
}
