'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { User } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoggedIn(true);
        setUserEmail(user.email);
      } else {
        setLoggedIn(false);
        setUserEmail(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMenuOpen(false);
    } catch (error) {
      console.error('Errore durante il logout:', error);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Benvenuto in ProjectCritics</h1>

      {/* Menu utente in alto a destra */}
      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '2rem',
          }}
        >
          <User size={24} />
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              backgroundColor: '#fff',
              boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
              padding: '1rem',
              borderRadius: '8px',
              zIndex: 10,
              width: '180px',
            }}
          >
            {!loggedIn ? (
              <>
                <button
                  onClick={() => router.push('/register')}
                  style={menuButtonStyle}
                >
                  Registrati
                </button>
                <button
                  onClick={() => router.push('/login')}
                  style={menuButtonStyle}
                >
                  Login
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '0.5rem', color: 'black' }}>
                  👋 Ciao, <strong>{userEmail}</strong>
                </p>
                <button onClick={handleLogout} style={menuButtonStyle}>
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pulsanti principali */}
      <button
        onClick={() => router.push('/create')}
        style={mainButtonStyle}
      >
        Crea Classifica
      </button>

      <button
        onClick={() => router.push('/classifiche')}
        style={{ ...mainButtonStyle, marginLeft: '1rem' }}
      >
        Classifiche
      </button>
    </main>
  );
}

// 🔧 Stili riutilizzabili
const menuButtonStyle = {
  width: '100%',
  padding: '0.5rem',
  fontSize: '1rem',
  cursor: 'pointer',
  marginBottom: '0.5rem',
  backgroundColor: '#eb5514',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
};

const mainButtonStyle = {
  padding: '0.5rem 1rem',
  fontSize: '1.2rem',
  cursor: 'pointer',
  marginTop: '1rem',
  backgroundColor: '#eb5514',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
};
