import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { OperatorDashboard } from './OperatorDashboard';
import styles from './OperatorRoute.module.css';

type Session = {
  id: number;
  token: string;
};

function AccessForm({
  message,
  onUnlock,
}: {
  message: string | null;
  onUnlock: (token: string) => void;
}) {
  const [entry, setEntry] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entry) return;
    onUnlock(entry);
    setEntry('');
  }

  return (
    <main className={styles.accessMain}>
      <section className={styles.accessCard} aria-labelledby="operator-access-title">
        <p className={styles.eyebrow}>Protected workspace</p>
        <h1 id="operator-access-title">Baahar operations</h1>
        <p>Use the operator token to check source health and run collection controls.</p>
        {message ? (
          <p className={styles.authProblem} role="alert">
            {message}
          </p>
        ) : null}
        <form className={styles.accessForm} onSubmit={submit}>
          <label htmlFor="operator-token">Operator token</label>
          <input
            id="operator-token"
            name="operator-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            required
          />
          <button type="submit">Open operations</button>
        </form>
        <Link to="/">Return to Baahar</Link>
      </section>
    </main>
  );
}

export default function OperatorRoute() {
  const queryClient = useQueryClient();
  const sessionCounter = useRef(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    delete document.documentElement.dataset.cityAccent;
  }, []);

  function clearSession(message: string | null) {
    queryClient.removeQueries({ queryKey: ['operator'] });
    setSession(null);
    setAuthMessage(message);
  }

  function unlock(token: string) {
    sessionCounter.current += 1;
    setAuthMessage(null);
    setSession({ id: sessionCounter.current, token });
  }

  if (!session) return <AccessForm message={authMessage} onUnlock={unlock} />;

  return (
    <OperatorDashboard
      sessionId={session.id}
      token={session.token}
      onLock={() => clearSession(null)}
      onUnauthorized={() => clearSession('That token was not accepted. Enter it again.')}
    />
  );
}
