import { useEffect, useMemo, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// BULLETPROOF SYNTHESIZED SOUND EFFECTS (No external files or CORS issues!)
// ============================================================================
const playReadySound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a beautiful double kitchen bell "Ding-Ding!"
    const playBell = (delay: number, pitch: number) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, audioCtx.currentTime + delay);
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime + delay);
      // Beautiful exponentially decaying chime ring
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + 1.2);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + 1.2);
    };

    playBell(0, 880);      // High A note
    playBell(0.12, 1046.5); // Higher C note shortly after
  } catch (e) {
    console.warn("Audio synthesis blocked or failed", e);
  }
};

const playAdminSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Warm, welcoming digital order chime (Arpeggio: C -> E -> G)
    const playNote = (delay: number, frequency: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'triangle'; // Soft retro triangle wave
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);
      
      gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration);
    };

    playNote(0, 523.25, 0.3);    // C5
    playNote(0.1, 659.25, 0.3);  // E5
    playNote(0.2, 783.99, 0.4);  // G5
  } catch (e) {
    console.warn("Audio synthesis blocked or failed", e);
  }
};
// ============================================================================

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
const toppingColors = ['#e07a5f', '#3d5a80', '#81b29a', '#b5838d', '#f4a261', '#5f0f40'];

const defaultToppings: Topping[] = [
  { id: 1, name: 'פלפל חריף', color: toppingColors[0] },
  { id: 2, name: 'בצל סגול', color: toppingColors[1] },
  { id: 3, name: 'זיתים', color: toppingColors[2] },
  { id: 4, name: 'בזיליקום', color: toppingColors[3] },
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
  const [status, setStatus] = useState('Design your dream slice below and send it straight to the oven!');

  const channelRef = useRef<any>(null);
  const stateRef = useRef({ toppings, submissions, notices, status });

  useEffect(() => {
    stateRef.current = { toppings, submissions, notices, status };
  }, [toppings, submissions, notices, status]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ toppings, submissions, notices }));
  }, [toppings, submissions, notices]);

  useEffect(() => {
    const handlePop = () => setRoute(getCurrentRoute());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Real-time synchronization
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
        window.localStorage.removeItem(STORAGE_KEY);
        setToppings(defaultToppings);
        setSubmissions([]);
        setNotices([]);
        setStatus("Welcome! The board has been cleared and prepared for a new pizza session.");
      })
      .on('broadcast', { event: 'request_state' }, () => {
        if (getCurrentRoute() === 'admin') {
          broadcastNewState(stateRef.current);
        }
      })
      .on('broadcast', { event: 'pizza_ready_sound' }, () => {
        playReadySound();
      })
      .on('broadcast', { event: 'new_order_sound' }, () => {
        if (getCurrentRoute() === 'admin') {
          playAdminSound();
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

  // Clean, completely silent toggle!
  const toggleSelection = (toppingId: number) => {
    setSelectedToppings((prev) =>
      prev.includes(toppingId) ? prev.filter((item) => item !== toppingId) : [...prev, toppingId],
    );
  };

  const handleSubmitChoice = (event: React.FormEvent) => {
    event.preventDefault();

    if (!guestName.trim()) {
      setStatus('Could you tell us your name first? 😊');
      return;
    }

    if (selectedToppings.length === 0) {
      setStatus("Don't forget to pick at least one delicious topping!");
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
    const newStatus = `Hooray! ${guestName.trim()}'s custom slice is now in the oven.`;

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
      setStatus('Let us know what yummy topping you want to add.');
      return;
    }

    const newItem: Topping = {
      id: Date.now(),
      name: value,
      color: toppingColors[toppings.length % toppingColors.length],
    };

    const nextToppings = [...toppings, newItem];
    const newStatus = `Sweet! "${value}" was added to the menu.`;

    setToppings(nextToppings);
    setNewTopping('');
    setStatus(newStatus);

    broadcastNewState({ toppings: nextToppings, submissions, notices, status: newStatus });
  };

  const handleDeleteTopping = (toppingId: number) => {
    const deletedTopping = toppings.find(t => t.id === toppingId);
    const nextToppings = toppings.filter((topping) => topping.id !== toppingId);
    const newStatus = deletedTopping 
      ? `We removed ${deletedTopping.name} from the ingredient counter.`
      : 'Removed a topping from the counter.';
    
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
      message: `🔔 Ding! ${submission.guestName}'s pizza slice is ready!`,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    const nextNotices = [notice, ...notices].slice(0, 5);
    const newStatus = `Hot and fresh! ${submission.guestName}'s pizza is ready to be enjoyed!`;

    setSubmissions(nextSubmissions);
    setNotices(nextNotices);
    setStatus(newStatus);

    // Play local host-side sound feedback instantly
    playReadySound();

    broadcastNewState({ toppings, submissions: nextSubmissions, notices: nextNotices, status: newStatus });
    
    if (channelRef.current) {
      void channelRef.current.send({
        type: 'broadcast',
        event: 'pizza_ready_sound',
      });
    }
  };

  const handleResetParty = () => {
    if (window.confirm("Are you sure you want to clear all requests and start a fresh Pizza Night? 🍕")) {
      window.localStorage.removeItem(STORAGE_KEY);
      
      const nextToppings = defaultToppings;
      setToppings(nextToppings);
      setSubmissions([]);
      setNotices([]);
      setStatus("The table is wiped clean! Welcome to a brand new pizza session.");

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
          <p className="subtitle">Choose your favorite toppings, and let the host know how to build your perfect slice!</p>
        </div>
        {route === 'admin' ? (
          <div className="hero-actions">
            <button className="pill" onClick={() => navigate('user')}>
              Guest View
            </button>
            <button className="pill active" onClick={() => navigate('admin')}>
              Host Dashboard
            </button>
          </div>
        ) : null}
      </header>

      <section className="status-banner">{status}</section>

      {route === 'user' ? (
        <div className="grid-layout">
          <section className="card">
            <div className="card-header">
              <h2>Design Your Slice</h2>
              <span>{totalSelections} delicious cravings</span>
            </div>

            <div className="notice-stack">
              {notices.length === 0 ? (
                <p className="muted">The chef is preparing the oven...</p>
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
                <span>What is your name?</span>
                <input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Your name, pizza lover! ✨" />
              </label>

              <div className="pizza-card">
                <div className="pizza-title" style={{ marginBottom: '12px' }}>
                  <span className="dot" style={{ backgroundColor: toppingColors[0] }} />
                  <span style={{ fontWeight: 600, color: '#4a4238' }}>Interactive Counter</span>
                </div>

                <div className="topping-list">
                  {toppings.map((topping) => (
                    <button
                      key={topping.id}
                      type="button"
                      className={`topping-option ${selectedToppings.includes(topping.id) ? 'selected' : ''}`}
                      style={{ borderColor: selectedToppings.includes(topping.id) ? topping.color : '#eae5dc' }}
                      onClick={() => {
                        toggleSelection(topping.id);
                      }}
                    >
                      <span className="chip-name">
                        <span className="dot" style={{ backgroundColor: topping.color }} />
                        <span>{topping.name}</span>
                      </span>
                      <strong>{selectedToppings.includes(topping.id) ? 'Selected ✓' : 'Add'}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <button className="primary-btn" type="submit">Send to Chef's Board 🍕</button>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Joined Friends</h2>
              <span>In-the-works</span>
            </div>
            <div className="results-list">
              {submissions.length === 0 ? (
                <p className="muted">No orders placed yet. Be the first!</p>
              ) : (
                submissions.map((submission) => (
                  <div key={submission.id} className="submission-row">
                    <div>
                      <strong>{submission.guestName}</strong>
                      <p>{submission.toppings.length > 0 ? submission.toppings.join(', ') : 'Simple Cheese Slice'}</p>
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
              <h2>Host Dashboard</h2>
              <span>Ingredients Board</span>
            </div>

            <div className="stack">
              <form onSubmit={handleAddTopping} className="stack">
                <label>
                  <span>Introduce a new ingredient</span>
                  <input value={newTopping} onChange={(event) => setNewTopping(event.target.value)} placeholder="e.g. Fresh Basil" />
                </label>
                <button className="primary-btn" type="submit">Add Topping</button>
              </form>

              <div className="menu-section">
                <h3>Counter Ingredients</h3>
                <div className="chip-list">
                  {toppings.map((topping) => (
                    <div key={topping.id} className="chip-row">
                      <span className="chip-name">
                        <span className="dot" style={{ backgroundColor: topping.color }} />
                        {topping.name}
                      </span>
                      <button type="button" className="ghost-btn danger" onClick={() => handleDeleteTopping(topping.id)}>
                        Discard
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="reset-container">
                <button type="button" className="reset-btn" onClick={handleResetParty}>
                  Reset Pizza Night
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>The Oven Queue</h2>
              <span>Live Orders</span>
            </div>
            <div className="results-list">
              {submissions.length === 0 ? (
                <p className="muted">No orders in the queue yet. Light the fire! 🔥</p>
              ) : (
                submissions.slice(0, 8).map((submission) => (
                  <div key={submission.id} className="submission-row">
                    <div>
                      <strong>{submission.guestName}</strong>
                      <p>{submission.toppings.join(', ') || 'Simple Cheese Slice'}</p>
                      {submission.ready ? <span className="ready-pill">Baked</span> : null}
                    </div>
                    <div className="inline-actions">
                      <button 
                        type="button" 
                        className="ghost-btn" 
                        onClick={() => handleNotifyReady(submission.id)}
                        disabled={submission.ready}
                      >
                        {submission.ready ? 'Served' : 'Mark Ready'}
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