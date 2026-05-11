import { computed } from '@preact/signals';
import { currentPosition } from '../../state/projection.ts';
import { requestFlyTo } from '../../state/viewport.ts';
import locationIcon from './imgs/location.svg?raw';
import styles from './LocationButton.module.css';

function onClick() {
  const p = currentPosition.value;
  if (!p) return;
  requestFlyTo({ lat: p.lat, lon: p.lon });
}

const disabled = computed(() => currentPosition.value === null);

export function LocationButton() {
  return (
    <button
      className={styles.button}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Centre map on my location"
    >
      <span
        className={styles.icon}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: locationIcon }}
      />
    </button>
  );
}
