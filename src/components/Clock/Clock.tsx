import { computed } from '@preact/signals';
import { elapsedFrom2026Sec } from '../../state/projection.ts';
import styles from './Clock.module.css';

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0)
    return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

const label = computed(() =>
  elapsedFrom2026Sec.value < 0 ? 'Until start' : 'Walking time',
);

const text = computed(() => formatDuration(Math.abs(elapsedFrom2026Sec.value)));

export function Clock() {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{text}</span>
    </div>
  );
}
