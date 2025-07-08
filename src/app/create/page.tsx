'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebaseConfig';
import { collection, addDoc, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { Home, User, Sun, Moon, X } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';

const validCounts = [2, 4, 6, 8, 16, 32, 64, 128, 256];

type ImageItem = {
  file?: File;
  preview: string;
  name: string;
  url?: string;
};

export default function CreatePage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);

  // USER/USERNAME STATE
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);

  // FORM STATE
  const [title, setTitle] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Recupero utente e username
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const imageItems = selectedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        name: file.name.replace(/\.[^/.]+$/, ''),
      }));
      setImages(imageItems);
      setError('');
    }
  };

  const handleNameChange = (index: number, newName: string) => {
    const updatedImages = [...images];
    updatedImages[index].name = newName;
    setImages(updatedImages);
  };

  const handleRemoveImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validCounts.includes(images.length)) {
      setError('Carica un numero di immagini valido: 2, 4, 6, 8, 16, 32, 64, 128, 256');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const uploadPromises = images.map(async (img) => {
        let url = img.url;
        if (!url && img.file) {
          url = await uploadToCloudinary(img.file);
        }
        if (!url) throw new Error('URL immagine mancante!');
        return { url, name: img.name };
      });
      const uploaded = await Promise.all(uploadPromises);

      await addDoc(collection(db, 'classifiche'), {
        title,
        images: uploaded,
        createdAt: Timestamp.now(),
      });

      setTitle('');
      setImages([]);
      alert('Classifica creata con successo!');
    } catch (err) {
      setError('Errore durante il caricamento o il salvataggio. Riprova.');
    } finally {
      setUploading(false);
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
        {/* Logo centrale */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <img
            src="/criticoni.png"
            alt="Logo Criticoni"
            className="h-14 md:h-20"
            style={{ width: 'auto', display: 'block' }}
          />
        </div>
        {/* Colonna destra */}
        <div style={{ width: 120, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
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
                zIndex: 20,
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
      <div className="max-w-xl mx-auto px-6 pb-16">
        <h1 className="text-2xl mb-1" style={{ fontWeight: 500 }}>
          Crea una nuova classifica
        </h1>
        <div className="mb-3 text-base" style={{ color: isDark ? "#fff" : "#000" }}>
          Immagini caricate: <span style={{ color: isDark ? "#fff" : "#000" }}>{images.length}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Titolo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 border rounded text-black bg-white text-lg"
            required
          />
          <div className="w-full">
            <label
              htmlFor="image-upload"
              className="inline-block bg-orange-600 hover:bg-orange-700 text-white py-2 px-5 rounded cursor-pointer text-base"
            >
              Scegli Immagini
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
              disabled={uploading}
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          {images.length > 0 && (
            <div className="mt-4 space-y-4">
              {images.map((img, index) => (
                <div key={index} className="flex items-center gap-4">
                  <img
                    src={img.preview}
                    alt={`img-${index}`}
                    className="w-24 h-24 object-cover rounded"
                  />
                  <input
                    type="text"
                    value={img.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    className="flex-1 p-2 border rounded text-black bg-white text-base"
                  />
                  <button
                    type="button"
                    className="ml-2 p-2 rounded bg-orange-600 hover:bg-orange-700"
                    title="Rimuovi immagine"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <X size={23} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 mt-6 rounded text-white text-xl"
            style={{ background: '#eb5514', fontWeight: 'normal', letterSpacing: 0.5 }}
            disabled={uploading}
          >
            {uploading ? 'Caricamento...' : 'Crea Classifica'}
          </button>
        </form>
      </div>
    </div>
  );
}
