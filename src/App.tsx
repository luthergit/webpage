import './App.css'
import TextareaAutosize from 'react-textarea-autosize';

import { useState, useEffect } from 'react';

export default function App() {

  // type Msg = { role: 'user' | 'assistant', content: string };
  // const [history, setHistory] = useState<Msg[]>([]);
  const [text, setText] = useState('Ask me anything :)');
  const [reply, setReply] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
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




  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
      setText(e.target.value);
    }


  async function login() {
    const LOGIN_URL = import.meta.env.VITE_LOGIN_URL;
    try {
      const r = await fetch(LOGIN_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: password})
      });
      if (r.ok){
        setAuthed(true);
        setPassword('');
        setReply('');
      } else {
        setReply('Invalid authorisation. Please check username/password.');
      }
      } catch {
        setReply('Network error. Please try again.');
      }
    }
  
  async function logout() {
    const LOGOUT_URL = import.meta.env.VITE_LOGOUT_URL;
    try {
      const r = await fetch(LOGOUT_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},});
    } finally {
      setAuthed(false);
      setUser('');
      setPassword('');
      setReply('');
    }}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authed) {
      setReply('Please login first.');
      return;}

    const CHATBOT_URL = import.meta.env.VITE_CHAT_URL;

    const payload = {
      message: text,
      temperature: 0.0,
      max_tokens: 500,
    };

    console.log('[chat] submitting payload:', payload);

    const res = await fetch(CHATBOT_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json'}, 
      body: JSON.stringify(payload),
    });
    console.log('res', res);

    if (!res.ok) {
      setReply(res.status === 401  ? 'Session expired. Please login again.' : `Request failed (HTTP ${res.status}).`);
      if (res.status === 401) {
        setAuthed(false);
      }
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
         <h1>React Webpage</h1>
        <p>This is a React webpage for a simple chatbot</p>
        
      </div>
    {checking ? null : (
      !authed ? (
        <div style={{display: 'flex', gap: 10, marginBottom: 12}}>
          <input 
            placeholder="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
          <input 
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" onClick={login} disabled={!user || !password}>
            Login</button>
        </div>
            ): null)}
      
      
      {authed && (
        <div>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      )}
      
  <form onSubmit={handleSubmit} style={{display: 'flex', alignItems: 'center', gap: '20px'}}>

    <TextareaAutosize
    style={{width: '500px', borderRadius: '10px', border: '1px solid #000', padding: '10px'}} 
    value={text} 
    onChange={handleChange} 
    placeholder="Ask me anything :)" 
    />
    <button type="submit" disabled={!authed || !text.trim()}>Send</button>
  </form>

  <TextareaAutosize
  style={{width: '500px', borderRadius: '10px', border: '1px solid #000', padding: '10px'}} 
  value={reply} 
  placeholder="Chatbot Response" 
  readOnly={true}
  /> 
  </>
  )

  }

