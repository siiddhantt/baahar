import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

import { ActionButton } from '../components/ActionButton';
import styles from './AppErrorBoundary.module.css';

type State = { failed: boolean };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Baahar could not render', {
      message: error.message,
      stack: info.componentStack,
    });
  }

  override render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className={styles.page}>
        <p>Something folded the wrong way.</p>
        <h1>Baahar needs a fresh start.</h1>
        <ActionButton onClick={() => window.location.reload()}>Reload the page</ActionButton>
      </main>
    );
  }
}
