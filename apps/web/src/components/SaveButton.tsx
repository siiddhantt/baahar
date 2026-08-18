import { toggleSaved, useSavedIds } from '../features/saved/savedStore';
import { BookmarkIcon } from './icons';
import styles from './SaveButton.module.css';

type Props = {
  occurrenceId: string;
  showLabel?: boolean;
};

export function SaveButton({ occurrenceId, showLabel = false }: Props) {
  const savedIds = useSavedIds();
  const saved = savedIds.includes(occurrenceId);

  return (
    <button
      className={styles.button}
      data-saved={saved}
      type="button"
      aria-label={saved ? 'Remove from saved events' : 'Save event'}
      aria-pressed={saved}
      onClick={() => toggleSaved(occurrenceId)}
    >
      <BookmarkIcon />
      {showLabel ? <span>{saved ? 'Saved' : 'Save'}</span> : null}
    </button>
  );
}
