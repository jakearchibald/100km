import { computed, type ReadonlySignal } from '@preact/signals';
import styles from './ProgressBar.module.css';

interface Props {
  label: string;
  color: string;
  pct: ReadonlySignal<number | null>;
}

export function ProgressBar({ label, color, pct }: Props) {
  const fillStyle = computed(() => {
    const v = pct.value;
    const clamped = v === null ? 0 : v < 0 ? 0 : v > 1 ? 1 : v;
    return `width: ${(clamped * 100).toFixed(1)}%; background: ${color};`;
  });
  const text = computed(() => {
    const v = pct.value;
    return v === null ? '—' : `${Math.round(v * 100)}%`;
  });
  return (
    <div className={styles.row}>
      <span className={styles.label} style={{ color }}>{label}</span>
      <span className={styles.track}>
        <span className={styles.fill} style={fillStyle} />
      </span>
      <span className={styles.pct}>{text}</span>
    </div>
  );
}
