'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import type { CSSProperties } from 'react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Email e password sono obbligatori!');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error: any) {
      console.error('Errore durante la registrazione:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('Questa email è già in uso.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('La password deve contenere almeno 6 caratteri.');
      } else {
        setErrorMessage('Errore durante la registrazione.');
      }
    }
  };

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Registrati</h1>

        {errorMessage && <div style={messageStyle}>{errorMessage}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="Inserisci la tua email"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="Inserisci la tua password"
          />
        </div>

        <button onClick={handleRegister} style={buttonStyle}>
          Registrati
        </button>
      </div>
    </main>
  );
}

// ✅ Stili corretti con tipi
const mainStyle: CSSProperties = {
  padding: '2rem',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  backgroundColor: 'black',
};

const cardStyle: CSSProperties = {
  backgroundColor: 'white',
  padding: '2rem 3rem',
  borderRadius: '8px',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  width: '100%',
  maxWidth: '400px',
};

const titleStyle: CSSProperties = {
  textAlign: 'center',
  marginBottom: '1rem',
  fontSize: '1.8rem',
  color: '#000',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '0.3rem',
  fontSize: '1rem',
  color: '#000',
};

const inputStyle: CSSProperties = {
  padding: '0.8rem',
  width: '100%',
  fontSize: '1rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.3s ease',
  color: 'black',
};

const buttonStyle: CSSProperties = {
  padding: '1rem',
  width: '100%',
  fontSize: '1.2rem',
  cursor: 'pointer',
  backgroundColor: '#eb5514',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  transition: 'background-color 0.3s ease',
};

const messageStyle: CSSProperties = {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '0.5rem',
  borderRadius: '4px',
  marginBottom: '1rem',
  textAlign: 'center',
};
