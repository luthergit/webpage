import './App.css'
import TextareaAutosize from 'react-textarea-autosize';

import { useState } from 'react';

export default function App() {

  type Msg = { role: 'user' | 'assistant', content: string };
  const [history, setHistory] = useState<Msg[]>([]);
  const [text, setText] = useState('Ask me anything :)');
  const [reply, setReply] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');



  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
      setText(e.target.value);
    }



function base64Utf8(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  const context = history.slice(-12);
  const payload = {
    message: text,
    history: context,
    temperature: 0.0,
    max_tokens: 1200,
  };

  console.log('[chat] submitting payload:', payload);
  console.log('[chat] history len:', context.length, 'last roles:', context.map(m => m.role));

  const CHATBOT_URL = import.meta.env.VITE_CHAT_URL;

  if (!user || !password) {
    setReply('Please enter a username and password.');
    return;
  }

  const basic = 'Basic ' +  base64Utf8(`${user}:${password}`);
  const res = await fetch(CHATBOT_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json', 
      'Authorization': basic,
    }, 
    body: JSON.stringify(payload),
  });

  if (res.status === 401 || res.status === 403) {
    setReply('Invalid authorisation. Please check username/password.');
    return;
  }
  const raw = await res.text();
  console.log('[chat] status:', res.status, 'ctype:', res.headers.get('content-type'));
  console.log('[chat] raw response:', raw);

  if (!res.ok) {
    setReply(`Request failed (HTTP ${res.status}).`);
    return;
  }

  let data: any = {};
  try { data = JSON.parse(raw || '{}'); } catch { /* keep empty */ }

  const next = [
    ...history,
    { role: 'user' as const, content: text },
    { role: 'assistant' as const, content: String(data.reply ?? '') },
  ];
  console.log('[chat] appending to history:', next.slice(-2));

  setReply(data.reply ?? 'No reply received.');
  setHistory(next.slice(-12));
}

  return (
    <>
    <div>
         <h1>React Webpage</h1>
        <p>This is a React webpage for Chatbot pipeline</p>
        <p>It's my webpage</p>
        
      </div>

  <div onSubmit={handleSubmit} style={{display: 'flex', gap: 10, marginBottom: 12}}>
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
  </div>
      
  <form onSubmit={handleSubmit} style={{display: 'flex', alignItems: 'center', gap: '20px'}}>

    <TextareaAutosize
    style={{width: '500px', borderRadius: '10px', border: '1px solid #000', padding: '10px'}} 
    value={text} 
    onChange={handleChange} 
    placeholder="Ask me anything :)" 
    />
    <button type="submit" disabled={!user || !password || !text.trim()}>Send</button>
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

