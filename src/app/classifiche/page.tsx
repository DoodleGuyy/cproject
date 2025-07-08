"use client";

import React, { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebaseConfig";
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Home, User, Sun, Moon } from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";

type Classifica = {
  id: string;
  title: string;
};

export default function ClassifichePage() {
  const [classifiche, setClassifiche] = useState<Classifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(true);

  // Stato utente per header
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    async function fetchClassifiche() {
      try {
        const q = query(collection(db, "classifiche"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const data: Classifica[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title,
        }));
        setClassifiche(data);
      } catch (err) {
        setError("Errore nel caricamento delle classifiche.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchClassifiche();
  }, []);

  // Recupero utente e username per header
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

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {/* HEADER */}
      <div className="relative flex items-center justify-between mb-12 px-8 pt-8" style={{ minHeight: 80 }}>
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
        {/* Logo centrale centrato verticalmente */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <img src="/criticoni.png" alt="Logo Criticoni" className="h-14 md:h-20 mx-auto" />
        </div>
        {/* Colonna destra */}
        <div style={{
          width: 120,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          position: 'relative',
          zIndex: 10
        }}>
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

      {/* BODY */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        <h1 className="text-2xl mb-10" style={{ letterSpacing: 0.2 }}>Classifiche</h1>

        {loading && <p>Caricamento classifiche...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && !error && classifiche.length === 0 && (
          <p>Nessuna classifica trovata.</p>
        )}

        <ul className="flex flex-col gap-7">
          {classifiche.map(({ id, title }) => (
            <li key={id}>
              <button
                onClick={() => router.push(`/classifiche/${id}`)}
                className="w-full py-5 rounded text-white shadow-xl transition hover:scale-105"
                style={{
                  background: '#eb5514',
                  fontSize: '1.30rem',
                  fontWeight: 'normal',
                  letterSpacing: 0.5,
                  minWidth: 250,
                  minHeight: 50,
                  textAlign: 'center'
                }}
              >
                {title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
