import { computed, type ReadonlySignal } from '@preact/signals';
import styles from './TimeDelta.module.css';

interface Props {
  label: string;
  color: string;
  delta: ReadonlySignal<number | null>;
}

function format(seconds: number): string {
  const abs = Math.abs(Math.round(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const sign = seconds >= 0 ? '+' : '−';
  const direction = seconds >= 0 ? 'ahead' : 'behind';
  if (h > 0) return `${sign}${h}h ${m.toString().padStart(2, '0')}m ${direction}`;
  if (m > 0) return `${sign}${m}m ${s.toString().padStart(2, '0')}s ${direction}`;
  return `${sign}${s}s ${direction}`;
}

export function TimeDelta({ label, color, delta }: Props) {
  const text = computed(() => {
    const v = delta.value;
    return v === null ? '—' : format(v);
  });
  const cls = computed(() => {
    const v = delta.value;
    if (v === null) return `${styles.value} ${styles.neutral}`;
    return `${styles.value} ${v >= 0 ? styles.ahead : styles.behind}`;
  });
  return (
    <div className={styles.row}>
      <span className={styles.label} style={{ color }}>{label}</span>
      <span className={cls}>{text}</span>
    </div>
  );
}
