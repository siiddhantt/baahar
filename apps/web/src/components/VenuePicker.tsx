import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { ChevronIcon } from './icons';
import styles from './VenuePicker.module.css';

type Props = {
  value: string;
  venues: string[];
  onChange: (venue: string) => void;
};

const anywhereOption = { label: 'Anywhere in the city', value: '' };

export function VenuePicker({ value, venues, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const valueId = useId();
  const listboxId = useId();
  const options = [anywhereOption, ...venues.map((venue) => ({ label: venue, value: venue }))];
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedLabel = options[selectedIndex]?.label ?? anywhereOption.label;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  function openPicker(index = selectedIndex) {
    setActiveIndex(index);
    setOpen(true);
  }

  function closePicker({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }

  function moveActive(nextIndex: number) {
    const wrappedIndex = (nextIndex + options.length) % options.length;
    setActiveIndex(wrappedIndex);
  }

  function selectOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closePicker({ restoreFocus: true });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openPicker(event.key === 'ArrowUp' ? options.length - 1 : selectedIndex);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveActive(0);
        break;
      case 'End':
        event.preventDefault();
        moveActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectOption(index);
        break;
      case 'Escape':
        event.preventDefault();
        closePicker({ restoreFocus: true });
        break;
      case 'Tab':
        closePicker();
        break;
    }
  }

  return (
    <div className={styles.picker} ref={root}>
      <span className={styles.label} id={labelId}>
        Venue
      </span>
      <button
        ref={trigger}
        className={styles.trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => (open ? closePicker() : openPicker())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.value} id={valueId}>
          {selectedLabel}
        </span>
        <ChevronIcon className={styles.chevron} aria-hidden="true" />
      </button>

      {open ? (
        <div className={styles.menu} id={listboxId} role="listbox" aria-labelledby={labelId}>
          {options.map((option, index) => (
            <button
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              className={styles.option}
              data-active={activeIndex === index}
              key={option.value || 'anywhere'}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={activeIndex === index ? 0 : -1}
              onClick={() => selectOption(index)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span>{option.label}</span>
              {option.value === value ? (
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
