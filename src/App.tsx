import { useEffect } from 'preact/hooks';
import { LocationButton } from './components/LocationButton/LocationButton.tsx';
import { Map } from './components/Map/Map.tsx';
import { Overlay } from './components/Overlay/Overlay.tsx';
import { ShareButton } from './components/ShareButton/ShareButton.tsx';
import { loadHistoric } from './data/historic.ts';
import './state/mode.ts';
import { loadError } from './state/loading.ts';
import { historic } from './state/signals.ts';
import { initLifecycle } from './state/visibility.ts';

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
      <Overlay />
      <ShareButton />
      <LocationButton />
    </>
  );
}

export default App;
