import './App.css'
import TextareaAutosize from 'react-textarea-autosize';

import { useState, useEffect, useContext, createContext, type ReactNode, useRef} from 'react';
import {Routes, Route, Link, Navigate, useLocation, useNavigate, useSearchParams} from 'react-router-dom';

type AuthCtx = {
  authed: boolean;
  checking: boolean;
  user: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error ('AuthContext missing');
  return ctx
}

function SiteNav() {
  const {pathname} = useLocation();
  return (
    <nav style={{display: 'flex', marginTop: 12, gap: 30}}>
      {pathname !== '/' && <Link to="/">Home</Link>}
      {pathname !== '/chat' && <Link to="/chat">Simple Conversational Chatbot</Link>}
      {pathname !== '/reasoning' && <Link to="/reasoning">Reasoning Chatbot</Link>}
    </nav>
  )
}
function AuthProvider({children}: {children: ReactNode}) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const SESSION_URL = import.meta.env.VITE_SESSION_URL;
    if (!SESSION_URL) {setChecking(false); return;}
    (async () => {
    try {
      const res = await fetch(SESSION_URL, {credentials: 'include',});
        setAuthed(res.ok);
        if (res.ok) {
          try {
            const data = await res.json().catch(() => null);
            const name = (data && (data.user)) || null;
            setUser(typeof name === 'string' ? name : null);
          } catch { setUser(null);}
        } else {
          setUser(null);
        }
      }
        catch {
          setAuthed(false);
          setUser(null);
        }
        finally {
          setChecking(false);
        }
      })();
  }, []);

  async function login(username: string, password: string) {
    const LOGIN_URL = import.meta.env.VITE_LOGIN_URL;
    try {
      const r = await fetch(LOGIN_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
      });
      if (r.ok){
        setAuthed(true); 
        setUser(username);
        return true}
      return false;
    } catch {
      return false;
    }
  }
  
  async function logout() {
    const LOGOUT_URL = import.meta.env.VITE_LOGOUT_URL;
    try {
      await fetch(LOGOUT_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},});
        
    } finally {
      setAuthed(false);
      setUser(null);
    }}

    return (
      <AuthContext.Provider value={{authed, checking, user, login, logout}}>
        {children}
      </AuthContext.Provider>
    )
}

function RequireAuth({children}: {children: ReactNode}) {
  const {authed, checking} = useAuth();
  const location = useLocation();
  if (checking) return null
  if (!authed) return <Navigate to="/login" state={{from: location}} replace />
  return children;
}

type ReasoningJobStatus = 'queued' | 'finished' | 'failed' | 'started' | 'unknown';
type ReasoningJob = {
  id: string;
  status: ReasoningJobStatus;
  reply?: string;
  error?: string;
  enqueuedAt: number;
  finishedAt?: number;
  lastPolledAt?: number;
};

type ReasoningCtx = {
  jobs: Record<string, ReasoningJob>;
  enqueue: (message: string) => Promise<{job_id?: string; error?: string}>;
  getJob: (id: string) => ReasoningJob | undefined;
  clearJob: (id: string) => void;
  clearAll: () => void;
};

const ReasoningContext = createContext<ReasoningCtx | null>(null);
function useReasoning() {
  const ctx = useContext(ReasoningContext);
  if (!ctx) throw new Error ('ReasoningContext missing');
  return ctx;
}

function ReasoningProvider({children}: {children: ReactNode}) {
  const {user: authUser, authed} = useAuth();
  const userKey = (authUser && String(authUser)) || 'default';
  const base = (import.meta.env.VITE_REASONING_URL || '').replace(/\/$/, '');

  const MAX_FINISHED_COUNT = 10;
  const MAX_FINISHED_AGE_MS = 10 * 60 * 1000;
  const MAX_LOCAL_BUDGET = 2 * 1024 * 1024;

  const jobsKey = (u: string) => `reasoning:${u}:jobs`;
  const replyKey = (u: string, id: string) => `reasoning:${u}:${id}`;

  const [jobs, setJobs] = useState<Record<string, ReasoningJob>>(() => {
    try {
      const raw = localStorage.getItem(jobsKey(userKey));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(jobsKey(userKey));
      setJobs(raw ? JSON.parse(raw) : {});
    } catch { setJobs({});}
    }, [userKey]);
  useEffect(() => {
    try {localStorage.setItem(jobsKey(userKey), JSON.stringify(jobs));}
    catch {}
  }, [jobs, userKey]);

  function estimateSizeBytes(): number {
    try {
      const enc = new TextEncoder();
      let total = enc.encode(localStorage.getItem(jobsKey(userKey)) || '').byteLength;
      for (const id of Object.keys(jobs)) {
        const raw = localStorage.getItem(replyKey(userKey, id)) || '';
        total += enc.encode(raw).byteLength;
    }
    return total;
  } catch { return 0;}

}
  function cleanup(now = Date.now()) {
    setJobs(prev => {
      let next = {...prev};

      for (const [id, j] of Object.entries(next)) {
        if ((j.status === 'finished' || j.status === 'failed')) {
          const ts = j.finishedAt || j.lastPolledAt || j.enqueuedAt;
          if (now - ts > MAX_FINISHED_AGE_MS) {
            delete next[id];
            try { localStorage.removeItem(replyKey(userKey, id)); }
            catch {}
          }
        }
      }
    

      const finishedIds = Object.keys(next).filter(id => next[id].status === 'finished' || next[id].status === 'failed')
      .sort((a, b) => {
        const ja = next[a]; const jb = next[b];
        const ta = ja.finishedAt || ja.lastPolledAt || ja.enqueuedAt;
        const tb = jb.finishedAt || jb.lastPolledAt || jb.enqueuedAt;
        return ta - tb;
      });

      while (finishedIds.length > MAX_FINISHED_COUNT) {
        const id = finishedIds.shift()!;
        delete next[id];
        try { localStorage.removeItem(replyKey(userKey, id)); }
        catch {}
      }

      let size = estimateSizeBytes();
      while (size > MAX_LOCAL_BUDGET) {
        const removable = Object.keys(next)
        .filter(id => next[id].status === 'finished' || next[id].status === 'failed')
        .sort((a,b) => {
          const ja = next[a]; const jb = next[b];
          const ta = ja.finishedAt || ja.lastPolledAt || ja.enqueuedAt;
          const tb = jb.finishedAt || jb.lastPolledAt || jb.enqueuedAt;
          return ta - tb;
        });
        if (removable.length === 0) break;
        const id = removable[0];
        delete next[id];
        try { localStorage.removeItem(replyKey(userKey, id)); }
        catch {}
        size = estimateSizeBytes();
        
      }

    try {
      const prefix = `reasoning:${userKey}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (k.startsWith(prefix) && k !== jobsKey(userKey)) {
          const id = k.slice(prefix.length);
          if (!next[id] && id) localStorage.removeItem(k);
        }
      }
    } catch {}
    return next;
  });
  }

  async function enqueue(message:string) {
    if (!base) return {error: 'Reasoning endpoint not configured'};
    try {
      const res = await fetch(base, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({message}),
      });
      if (!res.ok) return {error: `Enqueue failed (HTTP ${res.status}).`};


      const data = await res.json();
      const jobId: string | undefined = data?.job_id;
      if (!jobId) return {error: 'Missing job_id in response'};

      setJobs(prev => ({
        ...prev,
        [jobId]: {id: jobId, status: 'queued', enqueuedAt: Date.now()}
      }));

      cleanup();
      return {job_id: jobId};
    } catch { return {error: 'Network error while enqueueing.'}}

  }

  function getJob(id: string) {
      return jobs[id];
  }

  function clearJob(id: string) {
    setJobs(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });
    try {localStorage.removeItem(replyKey(userKey, id));} catch {}
  }

  function clearAll() {
    setJobs({});
    try {
      const prefix = `reasoning:${userKey}:`;
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  useEffect(() => {
    if (!authed) {
      clearAll();
    }
  }, [authed]);
  
  const isPolling = useRef(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (isPolling.current) return;
      const active = Object.values(jobs).filter(j => j.status !== 'finished' && j.status !== 'failed');
      if (active.length === 0 || !base) return;
      isPolling.current = true;
      try {
        await Promise.all(
          active.map(async (job) => {
            const pollUrl = `${base}/${encodeURIComponent(job.id)}`;
            try {
              const r = await fetch(pollUrl, {credentials: 'include'});
              if (r.status === 404) {
                if (Date.now() - job.enqueuedAt < 5000) return;
                setJobs(prev => ({
                  ...prev,
                  [job.id]: { ...prev[job.id], status: 'failed', error: 'Job not found', lastPolledAt: Date.now(), finishedAt: Date.now()},
                }));
                return;
            }
              if (!r.ok) {
                setJobs(prev => ({
                  ...prev,
                  [job.id]: { ...prev[job.id], status: 'failed', error: `Polling failed (HTTP ${r.status})`, lastPolledAt: Date.now(), finishedAt: Date.now() },
                }));
                return;
              }

              const data = await r.json();
              if (data.status === 'finished') {
                const out = data.result?.reply ?? 'No reply received.';
                setJobs(prev => ({
                  ...prev,
                  [job.id]: { ...prev[job.id], status: 'finished', reply: out, lastPolledAt: Date.now(), finishedAt: Date.now() },
                }));
                try { localStorage.setItem(replyKey(userKey, job.id), JSON.stringify({ reply: out })); } catch {}
              } else if (data.status === 'failed') {
                const errText = typeof data.error === 'string' ? data.error : 'Job failed';
                setJobs(prev => ({
                  ...prev,
                  [job.id]: { ...prev[job.id], status: 'failed', error: errText, lastPolledAt: Date.now(), finishedAt: Date.now() },
                }));
              } else {
                const nextStatus: ReasoningJobStatus = (data.status || 'started') as ReasoningJobStatus;
                setJobs(prev => ({
                  ...prev,
                  [job.id]: { ...prev[job.id], status: nextStatus, lastPolledAt: Date.now() },
                }));
              }
            } catch {
              // transient network error; keep active
            }
          })
        );
      } finally {
        isPolling.current = false;
        cleanup();
      }
    }, 1000);
  
    return () => clearInterval(timer);
  }, [jobs, base]);

  useEffect(() => {
    const ids = Object.keys(jobs);
    if (ids.length === 0) return;
    ids.forEach(id => {
      if (jobs[id]?.reply) return;
      try {
        const raw = localStorage.getItem(replyKey(userKey, id));
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (obj?.reply) {
          setJobs(prev => ({ ...prev, [id]: { ...prev[id], reply: obj.reply } }));
        }
      } catch {}
    });
  }, [userKey]);

  return (
    <ReasoningContext.Provider value={{ jobs, enqueue, getJob, clearJob, clearAll }}>
      {children}
    </ReasoningContext.Provider>
  );
  
  

}

function HomePage() {
  const {logout }= useAuth()
  return (
    <>
    <h1>Welcome to my page</h1>
    <p>Choose a demo below:</p>
    {/* <nav style={{display: 'flex',marginBottom: 12, gap: 30}}>
      <Link to="/chat">Simple Conversational Chatbot</Link>
      <Link to="/reasoning">Reasoning Chatbot</Link>
    </nav> */}
    <SiteNav />
    <div style={{marginTop: 12}}>
      <button type="button" onClick={() => {void logout();}}>Logout</button>
    </div>
    </>
  )
}

function LoginPage() {
  const {login} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await login(user, password)
    if (ok) navigate(from, {replace: true})
    else setErr('Invalid authorisation. Please check username/password.');
  }
  return (
    <>
    <h1>Welcome to my page</h1>
    <p>Please enter your username and password to login and access the site.</p>
    <form onSubmit={handleSubmit}>
      <input placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit" disabled={!user || !password}>Login</button>
    </form>
    {err ? <p style={{color: 'red'}}>{err}</p>: null}
    </>
  )
}

function ChatPage({title,paragraphs,chatUrl}: {title: string, paragraphs: string[], chatUrl: string}) {
  const [text, setText] = useState('Ask me anything :)');
  const [reply, setReply] = useState('');
  const {logout }= useAuth()

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();

      const payload = {
        message: text,
        temperature: 0.0,
        max_tokens: 500,
        stream: true,
      };

      console.log('[chat] submitting payload:', payload);

      setReply('');
      const res = await fetch(chatUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        }, 
        body: JSON.stringify(payload),
      });
      console.log('res', res);

      if (!res.ok) {
        setReply(res.status === 401  ? 'Session expired. Please login again.' : `Request failed (HTTP ${res.status}).`);
        return;
      }

      const ctype = res.headers.get('content-type');
      if (!ctype?.includes('text/event-stream') || !res.body) {
        // non-streaming response
        const raw = await res.text();
        console.log('[chat] status:', res.status, 'ctype:', res.headers.get('content-type'));
        console.log('[chat] raw response:', raw);


        let data: any = {};
        try { data = JSON.parse(raw || '{}'); } catch {}

        setReply(data.reply ?? 'No reply received.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneStreaming = false;

      while (!doneStreaming) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream:true});

        const events = buffer.split('\n\n')
        buffer = events.pop() || '';

        for (const evt of events) {
          const dataLines = evt
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trim());

          if (dataLines.length === 0) continue;
          const dataStr = dataLines.join('\n');
          if (dataStr === '[DONE]') {
            doneStreaming = true;
            break;
          }

          try {
            const obj = JSON.parse(dataStr);
            const piece = obj.delta
            if (piece) setReply(prev => prev + piece);
          }
          catch {}      
        } 

        }

        if (buffer) {
          try{
            const obj = JSON.parse(buffer);
            const piece = obj.delta;
            if (piece) setReply(prev => prev + piece);
          }
          catch {}
        }

  }

  return (
    <>
    <div>
      <h1>{title}</h1>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>

    {/* <nav style={{display: 'flex', marginTop: 12, gap: 30}}>
      <Link to="/">Home</Link>
      <Link to="/chat">Simple Conversational Chatbot</Link>
      <Link to="/reasoning">Reasoning Chatbot</Link>
    </nav> */}
    <SiteNav />

    <form onSubmit={handleSubmit} style={{display: 'flex', alignItems: 'center', gap: '20px'}}>

      <TextareaAutosize
      style={{width: '500px', borderRadius: '10px', border: '1px solid #000', padding: '10px'}} 
      value={text} 
      onChange={handleChange} 
      placeholder="Ask me anything :)" 
      />
      <button type="submit" disabled={!text.trim()}>Send</button>
    </form>

    <TextareaAutosize
      style={{width: '500px', borderRadius: '10px', border: '1px solid #000', padding: '10px'}} 
      value={reply} 
      placeholder="Chatbot Response" 
      readOnly={true}
      />

    <div style={{marginTop: 12}}>
      <button type="button" onClick={() => {void logout();}}>Logout</button>
    </div>


      </>
    
  )
}

function ReasoningPage({title,paragraphs}: {title: string, paragraphs: string[]}) {
  const [text, setText] = useState('Ask me something to reason about :)');
  const [reply, setReply] = useState('');
  const [pending, setPending] = useState(false);
  const {logout }= useAuth()
  const [searchParams, setSearchParams] = useSearchParams();
  const {jobs, enqueue, getJob } = useReasoning();

  const jobIdFromUrl = searchParams.get('job_id') || '';
  const job = jobIdFromUrl ? getJob(jobIdFromUrl) : undefined;

  useEffect(() => {
    if (!job) {setReply(''); return;}
    if (job.status === 'finished') setReply(job.reply ?? '');
    else if (job.status === 'failed') setReply(job.error ?? 'Job failed');
    else setReply('Job is still in progress...');
  }, [jobIdFromUrl, job?.status, job?.reply, job?.error]);

  useEffect(() => {
    if (jobIdFromUrl) return;
    const ids = Object.keys(jobs);
    if (ids.length === 0) return;

    // pick the most recent by finishedAt, lastPolledAt, then enqueuedAt
    let latestId = '';
    let latestTs = -1;
    for (const id of ids) {
      const j = jobs[id];
      const ts = (j.finishedAt ?? j.lastPolledAt ?? j.enqueuedAt) || 0;
      if (ts > latestTs) { latestTs = ts; latestId = id; }
    }
    if (latestId) setSearchParams({ job_id: latestId });
  }, [jobIdFromUrl, jobs, setSearchParams]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setReply('');
      setPending(true);
      const out = await enqueue(text);
      setPending(false);

      if (out.error) {
        setReply(out.error);
        return;
      }

      const jid = out.job_id;
      if (jid) {
        setSearchParams({job_id: jid});
      }

    }


  return (
    <>
    <div>
      <h1>{title}</h1>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>


    <SiteNav />

    <form onSubmit={handleSubmit} style={{display: 'flex', alignItems: 'center', gap: '20px'}}>

      <TextareaAutosize
      style={{width: '500px', borderRadius: '10px', border: '1px solid #000', padding: '10px'}} 
      value={text} 
      onChange={handleChange} 
      placeholder="Ask me something to reason about :)" 
      disabled={pending}
      />
      <button type="submit" disabled={pending || !text.trim()}>
        {pending ? 'Thinking' : 'Send'}
      </button>
    </form>

    <TextareaAutosize
      style={{width: '500px', borderRadius: '10px', border: '1px solid #000', padding: '10px'}} 
      value={reply} 
      placeholder="Reasoning Chatbot Response" 
      readOnly={true}
      />

    <div style={{marginTop: 12}}>
      <button type="button" onClick={() => {void logout();}} disabled={pending}>
        
        Logout</button>
    </div>


      </>
    
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ReasoningProvider>
      <Routes>
        <Route path="/" element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
          } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat" element={
          <RequireAuth>
            <ChatPage title="Simple Conversational Chatbot" paragraphs={['This is a React webpage for a simple conversational chatbot.']} 
            chatUrl={import.meta.env.VITE_CHAT_URL} />
          </RequireAuth>
          } />
        <Route path="/reasoning" element={
          <RequireAuth>
            <ReasoningPage title="Reasoning Chatbot" paragraphs={['This is a React webpage for a reasoning chatbot.']} 
             />
          </RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
        </ReasoningProvider>
      </AuthProvider>
  )

}
