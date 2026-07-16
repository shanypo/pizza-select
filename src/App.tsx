import { useEffect, useMemo, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const READY_SOUND_URL = 'https://actions.google.com/sounds/v1/notification/soft_bell.ogg';
const ADMIN_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/positive.ogg';

type Topping = {
  id: number;
  name: string;
  color: string;
};

type Submission = {
  id: number;
  guestName: string;
  toppings: string[];
  timestamp: string;
  ready: boolean;
};

type ReadyNotice = {
  id: number;
  message: string;
  timestamp: string;
};

const STORAGE_KEY = 'select-and-slice-state-v3';
const toppingColors = ['#ff7a59', '#4f46e5', '#16a34a', '#d946ef', '#f59e0b', '#0f766e'];

const defaultToppings: Topping[] = [
  { id: 1, name: 'Pepperoni', color: toppingColors[0] },
  { id: 2, name: 'Mushrooms', color: toppingColors[1] },
  { id: 3, name: 'Extra cheese', color: toppingColors[2] },
  { id: 4, name: 'Olives', color: toppingColors[3] },
];

function loadState() {
  if (typeof window === 'undefined') {
    return { toppings: defaultToppings, submissions: [] as Submission[], notices: [] as ReadyNotice[] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { toppings: defaultToppings, submissions: [] as Submission[], notices: [] as ReadyNotice[] };
    }

    const parsed = JSON.parse(raw) as { toppings?: Topping[]; submissions?: Submission[]; notices?: ReadyNotice[] };
    return {
      toppings: parsed.toppings?.length ? parsed.toppings : defaultToppings,
      submissions: parsed.submissions ?? [],
      notices: parsed.notices ?? [],
    };
  } catch {
    return { toppings: defaultToppings, submissions: [] as Submission[], notices: [] as ReadyNotice[] };
  }
}

function getCurrentRoute() {
  if (typeof window === 'undefined') {
    return 'user' as const;
  }
  return window.location.pathname.startsWith('/admin') ? ('admin' as const) : ('user' as const);
}

export default function App() {
  const [toppings, setToppings] = useState<Topping[]>(() => loadState().toppings);
  const [submissions, setSubmissions] = useState<Submission[]>(() => loadState().submissions);
  const [notices, setNotices] = useState<ReadyNotice[]>(() => loadState().notices ?? []);
  const [guestName, setGuestName] = useState('');
  const [selectedToppings, setSelectedToppings] = useState<number[]>([]);
  const [newTopping, setNewTopping] = useState('');
  const [route, setRoute] = useState<'user' | 'admin'>(getCurrentRoute);
  const [status, setStatus] = useState('Build your dream slice and share it with the group.');

  // Store active channel and latest states in refs to bypass React's closure/stale-state limitations
  const channelRef = useRef<any>(null);
  const stateRef = useRef({ toppings, submissions, notices, status });

  // Keep the mutable ref perfectly updated with the latest live state values
  useEffect(() => {
    stateRef.current = { toppings, submissions, notices, status };
  }, [toppings, submissions, notices, status]);

  // Save changes locally
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ toppings, submissions, notices }));
  }, [toppings, submissions, notices]);

  // Handle routing
  useEffect(() => {
    const handlePop = () => setRoute(getCurrentRoute());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Real-time synchronization via Supabase (Handles Listening)
  useEffect(() => {
    const channel = supabase.channel('pizza-party', {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'state_sync' }, ({ payload }) => {
        if (payload.toppings) setToppings(payload.toppings);
        if (payload.submissions) setSubmissions(payload.submissions);
        if (payload.notices) setNotices(payload.notices);
        if (payload.status) setStatus(payload.status);
      })
      .on('broadcast', { event: 'reset_party' }, () => {
        // Force fully clear local cache and state instantly on all peer phones
        window.localStorage.removeItem(STORAGE_KEY);
        setToppings(defaultToppings);
        setSubmissions([]);
        setNotices([]);
        setStatus("The pizza board has been reset for a new session!");
      })
      .on('broadcast', { event: 'request_state' }, () => {
        if (getCurrentRoute() === 'admin') {
          broadcastNewState(stateRef.current);
        }
      })
      .on('broadcast', { event: 'pizza_ready_sound' }, () => {
        try {
          const audio = new Audio(READY_SOUND_URL);
          void audio.play().catch(() => undefined);
        } catch {}
      })
      .on('broadcast', { event: 'new_order_sound' }, () => {
        if (getCurrentRoute() === 'admin') {
          try {
            const audio = new Audio(ADMIN_SOUND_URL);
            void audio.play().catch(() => undefined);
          } catch {}
        }
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && getCurrentRoute() === 'user') {
        void channel.send({
          type: 'broadcast',
          event: 'request_state',
        });
      }
    });

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Helper helper to broadcast state changes
  const broadcastNewState = (updated: {
    toppings: Topping[];
    submissions: Submission[];
    notices: ReadyNotice[];
    status: string;
  }) => {
    if (channelRef.current) {
      void channelRef.current.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: updated,
      });
    }
  };

  const navigate = (nextRoute: 'user' | 'admin') => {
    setRoute(nextRoute);
    const targetPath = nextRoute === 'admin' ? '/admin' : '/';
    window.history.pushState({}, '', targetPath);
  };

  const totalSelections = useMemo(() => {
    return submissions.reduce((sum, submission) => sum + submission.toppings.length, 0);
  }, [submissions]);

  const toggleSelection = (toppingId: number) => {
    setSelectedToppings((prev) =>
      prev.includes(toppingId) ? prev.filter((item) => item !== toppingId) : [...prev, toppingId],
    );
  };

  const handleSubmitChoice = (event: React.FormEvent) => {
    event.preventDefault();

    if (!guestName.trim()) {
      setStatus('Please enter your name first.');
      return;
    }

    if (selectedToppings.length === 0) {
      setStatus('Please choose at least one topping.');
      return;
    }

    const chosenToppingNames = toppings
      .filter((topping) => selectedToppings.includes(topping.id))
      .map((topping) => topping.name);

    const newSubmission: Submission = {
      id: Date.now(),
      guestName: guestName.trim(),
      toppings: chosenToppingNames,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      ready: false,
    };

    const nextSubmissions = [newSubmission, ...submissions];
    const newStatus = `${guestName.trim()} submitted a pizza request.`;

    setSubmissions(nextSubmissions);
    setStatus(newStatus);
    setGuestName('');
    setSelectedToppings([]);

    broadcastNewState({ toppings, submissions: nextSubmissions, notices, status: newStatus });
    
    if (channelRef.current) {
      void channelRef.current.send({
        type: 'broadcast',
        event: 'new_order_sound',
      });
    }
  };

  const handleAddTopping = (event: React.FormEvent) => {
    event.preventDefault();

    const value = newTopping.trim();
    if (!value) {
      setStatus('Type a topping name first.');
      return;
    }

    const newItem: Topping = {
      id: Date.now(),
      name: value,
      color: toppingColors[toppings.length % toppingColors.length],
    };

    const nextToppings = [...toppings, newItem];
    const newStatus = `${value} was added to the topping list.`;

    setToppings(nextToppings);
    setNewTopping('');
    setStatus(newStatus);

    broadcastNewState({ toppings: nextToppings, submissions, notices, status: newStatus });
  };

  const handleDeleteTopping = (toppingId: number) => {
    const nextToppings = toppings.filter((topping) => topping.id !== toppingId);
    const newStatus = 'A topping was removed from the menu.';
    
    setToppings(nextToppings);
    setSelectedToppings((prev) => prev.filter((id) => id !== toppingId));
    setStatus(newStatus);

    broadcastNewState({ toppings: nextToppings, submissions, notices, status: newStatus });
  };

  const handleNotifyReady = (submissionId: number) => {
    const submission = submissions.find((item) => item.id === submissionId);
    
    if (!submission || submission.ready) {
      return;
    }

    const nextSubmissions = submissions.map((item) =>
      item.id === submissionId ? { ...item, ready: true } : item,
    );

    const notice: ReadyNotice = {
      id: Date.now(),
      message: `${submission.guestName}'s pizza is ready!`,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    const nextNotices = [notice, ...notices].slice(0, 5);
    const newStatus = `${submission.guestName}'s pizza is ready.`;

    setSubmissions(nextSubmissions);
    setNotices(nextNotices);
    setStatus(newStatus);

    broadcastNewState({ toppings, submissions: nextSubmissions, notices: nextNotices, status: newStatus });
    
    if (channelRef.current) {
      void channelRef.current.send({
        type: 'broadcast',
        event: 'pizza_ready_sound',
      });
    }
  };

  // Resets the party state locally, in local storage, and broadcasts a direct wipe command to clients
  const handleResetParty = () => {
    if (window.confirm("Are you sure you want to clear all requests and restore default toppings for a new session?")) {
      // Clear Local Storage Cache
      window.localStorage.removeItem(STORAGE_KEY);

      // Reset Local State
      setToppings(defaultToppings);
      setSubmissions([]);
      setNotices([]);
      setStatus("The pizza board has been reset for a new session!");

      // Force instant hard reset command to all peer client browsers
      if (channelRef.current) {
        void channelRef.current.send({
          type: 'broadcast',
          event: 'reset_party',
        });
      }
    }
  };

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Select & Slice</p>
          <h1>Pizza Party Picks</h1>
          <p className="subtitle">Friends build their dream slice, and the manager keeps the full topping story in one place.</p>
        </div>
        {route === 'admin' ? (
          <div className="hero-actions">
            <button className="pill" onClick={() => navigate('user')}>
              User version
            </button>
            <button className="pill active" onClick={() => navigate('admin')}>
              Admin version
            </button>
          </div>
        ) : null}
      </header>

      <section className="status-banner">{status}</section>

      {route === 'user' ? (
        <div className="grid-layout">
          <section className="card">
            <div className="card-header">
              <h2>Build your slice</h2>
              <span>{totalSelections} toppings selected</span>
            </div>

            <div className="notice-stack">
              {notices.length === 0 ? (
                <p className="muted">No pizza is ready yet.</p>
              ) : (
                notices.slice(0, 3).map((notice) => (
                  <div key={notice.id} className="notice-pill">
                    <strong>{notice.message}</strong>
                    <span>{notice.timestamp}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSubmitChoice} className="stack">
              <label>
                <span>Your name</span>
                <input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="e.g. Omar" />
              </label>

              <div className="pizza-card">
                <div className="pizza-title">
                  <span className="dot" style={{ backgroundColor: toppingColors[0] }} />
                  <h3>pizza</h3>
                </div>

                <div className="topping-list">
                  {toppings.map((topping) => (
                    <button
                      key={topping.id}
                      type="button"
                      className={`topping-option ${selectedToppings.includes(topping.id) ? 'selected' : ''}`}
                      style={{ borderColor: topping.color }}
                      onClick={() => toggleSelection(topping.id)}
                    >
                      <span className="dot" style={{ backgroundColor: topping.color }} />
                      <span>{topping.name}</span>
                      <strong>Select</strong>
                    </button>
                  ))}
                </div>
              </div>

              <button className="primary-btn" type="submit">Send this pizza</button>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Live toppings</h2>
              <span>See what others chose</span>
            </div>
            <div className="results-list">
              {submissions.length === 0 ? (
                <p className="muted">No pizza choices yet.</p>
              ) : (
                submissions.map((submission) => (
                  <div key={submission.id} className="submission-row">
                    <div>
                      <strong>{submission.guestName}</strong>
                      <p>{submission.toppings.length > 0 ? submission.toppings.join(', ') : 'No toppings selected'}</p>
                    </div>
                    <span>{submission.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid-layout">
          <section className="card">
            <div className="card-header">
              <h2>Manager board</h2>
              <span>Manage toppings and pizza requests</span>
            </div>

            <div className="stack">
              <form onSubmit={handleAddTopping} className="stack">
                <label>
                  <span>New topping</span>
                  <input value={newTopping} onChange={(event) => setNewTopping(event.target.value)} placeholder="e.g. Jalapeños" />
                </label>
                <button className="primary-btn" type="submit">Add topping</button>
              </form>

              <div className="menu-section">
                <h3>Current toppings</h3>
                <div className="chip-list">
                  {toppings.map((topping) => (
                    <div key={topping.id} className="chip-row">
                      <span className="chip-name">
                        <span className="dot" style={{ backgroundColor: topping.color }} />
                        {topping.name}
                      </span>
                      <button type="button" className="ghost-btn" onClick={() => handleDeleteTopping(topping.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Reset Pizza Night Button */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px dashed #e2e8f0', paddingTop: '1.5rem' }}>
                <button type="button" className="primary-btn" style={{ backgroundColor: '#ef4444' }} onClick={handleResetParty}>
                  Reset Pizza Night
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>pizza requests</h2>
              <span>See every creation and mark it ready</span>
            </div>
            <div className="results-list">
              {submissions.length === 0 ? (
                <p className="muted">No submissions yet.</p>
              ) : (
                submissions.slice(0, 8).map((submission) => (
                  <div key={submission.id} className="submission-row">
                    <div>
                      <strong>{submission.guestName}</strong>
                      <p>{submission.toppings.join(', ') || 'No toppings selected'}</p>
                      {submission.ready ? <span className="pill ready-pill">Ready</span> : null}
                    </div>
                    <div className="inline-actions">
                      <button 
                        type="button" 
                        className="ghost-btn" 
                        onClick={() => handleNotifyReady(submission.id)}
                        disabled={submission.ready}
                      >
                        {submission.ready ? 'Done' : 'Ready'}
                      </button>
                      <span>{submission.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}