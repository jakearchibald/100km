import { computed, signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Map } from './components/Map/Map.tsx';
import { Overlay } from './components/Overlay/Overlay.tsx';
import { Spinner } from './components/Spinner/Spinner.tsx';
import { loadHistoric } from './data/historic.ts';
import './state/mode.ts';
import { historic } from './state/signals.ts';
import { initLifecycle } from './state/visibility.ts';

const loadError = signal<string | null>(null);

const overlayOrSpinner = computed(() => {
  if (loadError.value) {
    return <Spinner label={`Historic data failed: ${loadError.value}`} />;
  }
  return historic.value ? <Overlay /> : <Spinner label="Loading historic tracks…" />;
});

function App() {
  useEffect(() => {
    initLifecycle();
    loadHistoric().then(
      (data) => {
        historic.value = data;
      },
      (err) => {
        console.warn('[historic] failed', err);
        loadError.value = err instanceof Error ? err.message : String(err);
      },
    );
  }, []);

  return (
    <>
      <Map />
      {overlayOrSpinner}
    </>
  );
}

export default App;
