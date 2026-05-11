import { COLORS } from '../../constants.ts';
import {
  delta2021Sec,
  delta2022Sec,
  progress2021,
  progress2022,
  progress2026,
} from '../../state/projection.ts';
import { ProgressBar } from '../ProgressBar/ProgressBar.tsx';
import { ShareButton } from '../ShareButton/ShareButton.tsx';
import { TimeDelta } from '../TimeDelta/TimeDelta.tsx';
import styles from './Overlay.module.css';

export function Overlay() {
  return (
    <div className={styles.overlay}>
      <div className={styles.section}>
        <ProgressBar label="2026" color={COLORS.y2026} pct={progress2026} />
        <ProgressBar label="2022" color={COLORS.y2022} pct={progress2022} />
        <ProgressBar label="2021" color={COLORS.y2021} pct={progress2021} />
      </div>
      <div className={styles.divider} />
      <div className={styles.section}>
        <TimeDelta label="vs '22" color={COLORS.y2022} delta={delta2022Sec} />
        <TimeDelta label="vs '21" color={COLORS.y2021} delta={delta2021Sec} />
      </div>
      <ShareButton />
    </div>
  );
}
