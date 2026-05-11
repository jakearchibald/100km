import { computed, signal } from '@preact/signals';
import { buildShareUrl, share } from '../../share/share.ts';
import { currentPosition, currentTimeMs } from '../../state/projection.ts';
import shareIcon from './imgs/share.svg?raw';
import styles from './ShareButton.module.css';

const toast = signal<string>('');
let toastTimer: number | null = null;

function flashToast(msg: string) {
  toast.value = msg;
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = '';
    toastTimer = null;
  }, 2500);
}

async function onClick() {
  const url = buildShareUrl(currentPosition.value, currentTimeMs.value);
  try {
    const result = await share(url);
    if (result === 'copied') flashToast('Link copied');
    else if (result === 'shared') flashToast('Shared');
  } catch (err) {
    console.warn('[share] failed', err);
    flashToast('Could not share');
  }
}

const toastClass = computed(() =>
  toast.value ? `${styles.toast} ${styles.toastVisible}` : styles.toast,
);

export function ShareButton() {
  return (
    <>
      <button
        className={styles.button}
        type="button"
        onClick={onClick}
        aria-label="Share my progress"
      >
        <span
          className={styles.icon}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: shareIcon }}
        />
      </button>
      <div className={toastClass} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
