import './App.css'
import TextareaAutosize from 'react-textarea-autosize';

import { useState, useEffect, useContext, createContext, type ReactNode} from 'react';
import {Routes, Route, Link, Navigate, useLocation, useNavigate} from 'react-router-dom';

type AuthCtx = {
  authed: boolean;
  checking: boolean;
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

  useEffect(() => {
    const SESSION_URL = import.meta.env.VITE_SESSION_URL;
    if (!SESSION_URL) {setChecking(false); return;}
    (async () => {
    try {
      const res = await fetch(SESSION_URL, {
        credentials: 'include',});
        setAuthed(res.ok);}
        catch {
          setAuthed(false);
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
        setAuthed(true); return true}
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
    }}

    return (
      <AuthContext.Provider value={{authed, checking, login, logout}}>
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
      };

      console.log('[chat] submitting payload:', payload);

      const res = await fetch(chatUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'}, 
        body: JSON.stringify(payload),
      });
      console.log('res', res);

      if (!res.ok) {
        setReply(res.status === 401  ? 'Session expired. Please login again.' : `Request failed (HTTP ${res.status}).`);
        return;
      }
      const raw = await res.text();
      console.log('[chat] status:', res.status, 'ctype:', res.headers.get('content-type'));
      console.log('[chat] raw response:', raw);


      let data: any = {};
      try { data = JSON.parse(raw || '{}'); } catch {}

      setReply(data.reply ?? 'No reply received.');


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

export default function App() {
  return (
    <AuthProvider>
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
            <ChatPage title="Reasoning Chatbot" paragraphs={['This is a React webpage for a reasoning chatbot.']} 
            chatUrl={import.meta.env.VITE_REASONING_URL} />
          </RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
  )

}


