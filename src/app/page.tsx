'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, realtimeDb } from '@/lib/firebaseConfig';
import { Home, User, Sun, Moon, Trash2 } from 'lucide-react';
import {
  collection,
  getDocs,
  deleteDoc,
  doc as fsDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';

export default function HomePage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Segreto: mostra cestino solo digitando "eliminastanzevuote"
  const [showTrash, setShowTrash] = useState(false);
  const secretBuffer = useRef('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoggedIn(true);
        setUserEmail(user.email);
        setUserUid(user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data()?.username || '');
          setUsernameInput(userDoc.data()?.username || '');
        } else {
          setUsername('');
          setUsernameInput('');
        }
      } else {
        setLoggedIn(false);
        setUserEmail(null);
        setUserUid(null);
        setUsername('');
        setUsernameInput('');
      }
    });
    return () => unsubscribe();
  }, []);

  // Listener globale per il comando segreto
  useEffect(() => {
    function handleSecretKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return; // ignora combinazioni
      const char = e.key.length === 1 ? e.key : '';
      if (!char) return;
      secretBuffer.current = (secretBuffer.current + char).slice(-25);
      if (secretBuffer.current.toLowerCase().includes('eliminastanzevuote')) {
        setShowTrash(true);
        secretBuffer.current = '';
        setTimeout(() => setShowTrash(false), 60000);
      }
    }
    window.addEventListener('keydown', handleSecretKey);
    return () => window.removeEventListener('keydown', handleSecretKey);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMenuOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Errore durante il logout:', error);
    }
  };

  const saveUsername = async () => {
    if (!userUid) return;
    const chosen = usernameInput.trim();
    if (!chosen) return;
    setUsernameLoading(true);
    await setDoc(doc(db, 'users', userUid), { username: chosen }, { merge: true });
    setUsername(chosen);
    setEditingUsername(false);
    setUsernameLoading(false);
  };

  const cleanEmptyRooms = async () => {
    if (cleaning) return;
    setCleaning(true);
    try {
      const stanzeSnap = await getDocs(collection(db, 'stanze'));
      let count = 0;
      for (const roomDoc of stanzeSnap.docs) {
        const roomId = roomDoc.id;
        const presRef = rtdbRef(realtimeDb, `presence/${roomId}`);
        const snap = await rtdbGet(presRef);
        const online = snap.exists() ? snap.val() : null;
        if (!online || Object.keys(online).length === 0) {
          await deleteDoc(fsDoc(db, 'stanze', roomId));
          count++;
        }
      }
      alert(
        count > 0
          ? `Pulizia completata! ${count} stanze vuote eliminate.`
          : 'Nessuna stanza vuota da eliminare.'
      );
    } catch (err) {
      alert('Errore durante la pulizia: ' + (err as any).message);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-12 px-8 pt-8" style={{ minHeight: 80 }}>
        {/* Colonna sinistra */}
        <div style={{ width: 120, display: "flex", justifyContent: "flex-start" }}>
          <button
            onClick={() => router.push('/')}
            className="hover:scale-110 transition-transform"
            aria-label="Home"
          >
            <Home size={36} />
          </button>
        </div>
        {/* Logo centrale, centrato verticalmente! */}
        <div style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <img
            src="/criticoni.png"
            alt="Logo Criticoni"
            className="h-14 md:h-20"
            style={{
              width: 'auto',
              display: 'block'
            }}
          />
        </div>
        {/* Colonna destra */}
        <div style={{ width: 120, display: "flex", justifyContent: "flex-end", alignItems: "center", position: "relative" }}>
          <button
            onClick={() => setIsDark((d) => !d)}
            className="mr-4 hover:scale-110 transition-transform"
            aria-label="Switch theme"
          >
            {isDark ? <Sun size={32} /> : <Moon size={32} />}
          </button>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="User menu"
            className="hover:scale-110 transition-transform"
          >
            <User size={32} />
          </button>
          {/* MENU UTENTE */}
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                backgroundColor: "#fff",
                boxShadow: '0px 4px 20px rgba(0,0,0,0.17)',
                padding: '1.2rem',
                borderRadius: '14px',
                zIndex: 100,
                width: '260px',
                minHeight: '180px',
                color: "#111",
                border: "1px solid #eee",
                transition: 'background .18s'
                
              }}
            >
              {!loggedIn ? (
                <>
                  <button
                    onClick={() => router.push('/register')}
                    className="w-full py-2 px-3 rounded mb-2"
                    style={{ backgroundColor: '#eb5514', color: 'white', fontWeight: 'normal', fontSize: '1.06rem' }}
                  >
                    Registrati
                  </button>
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full py-2 px-3 rounded mb-2"
                    style={{ backgroundColor: '#eb5514', color: 'white', fontWeight: 'normal', fontSize: '1.06rem' }}
                  >
                    Login
                  </button>
                </>
              ) : (
                <>
                  <p style={{
                    marginBottom: '0.5rem',
                    color: '#111',
                    minHeight: '28px',
                    fontWeight: 'normal',
                    fontSize: '1.12rem'
                  }}>
                    👋 Ciao, <span style={{ color: "#111" }}>{username || userEmail}</span>
                  </p>
                  {/* Username section */}
                  <div style={{ marginBottom: 16 }}>
                    <span style={{
                      fontSize: '1.07em',
                      color: '#111',
                      fontWeight: 'normal'
                    }}>
                      Username:
                    </span>
                    {!editingUsername ? (
                      <span>
                        <span style={{ marginLeft: 6, color: '#111', fontWeight: 'normal' }}>
                          {username || <i style={{ color: '#111' }}>Non impostato</i>}
                        </span>
                        <button
                          style={{
                            marginLeft: 10,
                            padding: '2px 11px',
                            fontSize: '1em',
                            background: '#eb5514',
                            color: 'white',
                            border: 'none',
                            borderRadius: 5,
                            cursor: 'pointer',
                            fontWeight: 'normal'
                          }}
                          onClick={() => setEditingUsername(true)}
                        >
                          {username ? 'Modifica' : 'Imposta'}
                        </button>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                        <input
                          value={usernameInput}
                          onChange={e => setUsernameInput(e.target.value)}
                          placeholder="Scegli username"
                          disabled={usernameLoading}
                          style={{
                            padding: '6px 11px',
                            borderRadius: 6,
                            border: '1px solid #ccc',
                            marginRight: 8,
                            flex: 1,
                            color: '#111',
                            fontWeight: 'normal'
                          }}
                          maxLength={18}
                        />
                        <button
                          onClick={saveUsername}
                          style={{
                            padding: '6px 16px',
                            marginRight: 7,
                            background: '#eb5514',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 'normal'
                          }}
                          disabled={usernameLoading || !usernameInput.trim()}
                        >
                          Salva
                        </button>
                        <button
                          onClick={() => {
                            setEditingUsername(false);
                            setUsernameInput(username);
                          }}
                          style={{
                            padding: '6px 10px',
                            background: '#eee',
                            color: '#111',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 'normal'
                          }}
                          disabled={usernameLoading}
                        >
                          Annulla
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 px-3 rounded"
                    style={{ backgroundColor: '#eb5514', color: 'white', fontWeight: 'normal', fontSize: '1.06rem' }}
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PULSANTI CENTRATI GRANDI */}
      <div className="flex flex-col items-center justify-center mt-16" style={{ minHeight: "46vh" }}>
        <div className="flex flex-col items-center space-y-6">
          <button
            onClick={() => router.push('/create')}
            className="px-16 py-5 rounded text-white shadow-xl transition hover:scale-105"
            style={{ background: '#eb5514', fontSize: '1.45rem', fontWeight: 'normal', minWidth: 330, letterSpacing: 0.5 }}
          >
            Crea Classifica
          </button>
          <button
            onClick={() => router.push('/classifiche')}
            className="px-16 py-5 rounded text-white shadow-xl transition hover:scale-105"
            style={{ background: '#eb5514', fontSize: '1.45rem', fontWeight: 'normal', minWidth: 330, letterSpacing: 0.5 }}
          >
            Classifiche
          </button>
        </div>
      </div>

      {/* Pulsante di pulizia */}
      {showTrash && (
        <button
          onClick={cleanEmptyRooms}
          disabled={cleaning}
          style={{
            position: 'fixed',
            bottom: '38px',
            right: '40px',
            background: '#eb5514',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '70px',
            height: '70px',
            fontSize: '2.1rem',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.13)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: cleaning ? 'not-allowed' : 'pointer',
            zIndex: 50,
            transition: 'background .18s',
            fontWeight: 'normal'
          }}
          title="Elimina tutte le stanze vuote"
        >
          <Trash2 size={35} />
        </button>
      )}
    </div>
  );
}
