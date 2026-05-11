import styles from './Spinner.module.css';

interface Props {
  label?: string;
}

export function Spinner({ label = 'Loading…' }: Props) {
  return (
    <div className={styles.spinner} role="status" aria-live="polite">
      <span className={styles.dot} />
      {label}
    </div>
  );
}
