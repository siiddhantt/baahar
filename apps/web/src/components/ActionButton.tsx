import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

import styles from './ActionButton.module.css';

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  tone?: 'solid' | 'quiet';
};

export function ActionButton({ children, className, tone = 'solid', ...props }: Props) {
  return (
    <button
      className={[styles.button, styles[tone], className].filter(Boolean).join(' ')}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
