// ...inizio file...

'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Home, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';

type ImageItem = {
  url: string;
  name: string;
};

export default function Page() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [roundImages, setRoundImages] = useState<ImageItem[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [winners, setWinners] = useState<ImageItem[]>([]);
  const [finalWinner, setFinalWinner] = useState<ImageItem | null>(null);
  const [title, setTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const isHost = useRef(false);
  const confettiLaunched = useRef(false);

  const currentPair = roundImages.slice(currentPairIndex, currentPairIndex + 2);

  // 1. Caricamento dati classifica
  useEffect(() => {
    async function fetchData() {
      const ref = doc(db, 'classifiche', id as string);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setTitle(data.title);
        setRoundImages([...data.images].sort(() => Math.random() - 0.5));
      }
    }
    fetchData();
  }, [id]);

  // 2. Entra o crea stanza
  useEffect(() => {
    async function joinOrCreateRoom() {
      const roomFromUrl = searchParams.get('room');
      const name = prompt('Inserisci il tuo nome:');
      if (!name) return;
      setUsername(name);

      if (roomFromUrl) {
        isHost.current = false;
        const roomRef = doc(db, 'stanze', roomFromUrl);
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
          await updateDoc(roomRef, {
            partecipanti: arrayUnion(name),
          });
          setRoomId(roomFromUrl);
          return;
        }
      }

      isHost.current = true;
      const newRoom = await addDoc(collection(db, 'stanze'), {
        classificaId: id,
        partecipanti: [name],
        createdAt: serverTimestamp(),
      });
      setRoomId(newRoom.id);
      router.replace(`?room=${newRoom.id}`);
    }

    joinOrCreateRoom();
  }, [id]);

  // 3. Sync in tempo reale stato e partecipanti
  useEffect(() => {
    if (!roomId) return;

    const unsub = onSnapshot(doc(db, 'stanze', roomId), (docSnap) => {
      const data = docSnap.data();
      if (!data) return;

      if (data.partecipanti) setParticipants(data.partecipanti);

      if (!isHost.current) {
        if (data.roundImages) setRoundImages(data.roundImages);
        if (typeof data.currentPairIndex === 'number') setCurrentPairIndex(data.currentPairIndex);
        if (data.finalWinner) {
          setFinalWinner(data.finalWinner);
          setShowFinal(true);
        }
      }
    });

    return () => unsub();
  }, [roomId]);

  // 4. Rimuovi partecipante alla chiusura
  useEffect(() => {
    const handleUnload = () => {
      if (roomId && username) {
        const url = `/api/removeParticipant?roomId=${roomId}&username=${encodeURIComponent(username)}`;
        navigator.sendBeacon(url);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [roomId, username]);

  // 5. Gestione votazione
  const handleVote = async (winner: ImageItem) => {
    if (!isHost.current || disabled) return;
    setSelectedImage(winner);
    setDisabled(true);

    setTimeout(async () => {
      const newWinners = [...winners, winner];
      const isLastPair = currentPairIndex + 2 >= roundImages.length;
      let nextRound = roundImages;
      let nextIndex = currentPairIndex + 2;

      if (isLastPair) {
        if (roundImages.length === 2) {
          setFinalWinner(winner);
          await updateDoc(doc(db, 'stanze', roomId!), {
            finalWinner: winner,
          });
          return;
        } else {
          nextRound = newWinners;
          nextIndex = 0;
          setWinners([]);
        }
      }

      setRoundImages(nextRound);
      setCurrentPairIndex(nextIndex);
      setSelectedImage(null);
      setDisabled(false);

      await updateDoc(doc(db, 'stanze', roomId!), {
        roundImages: nextRound,
        currentPairIndex: nextIndex,
        finalWinner: null,
      });
    }, 350);
  };

  // 6. Effetto confetti
  useEffect(() => {
    if (finalWinner && !confettiLaunched.current) {
      confettiLaunched.current = true;
      setTimeout(() => {
        setShowFinal(true);
        confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 }, colors: ['#eb5514', '#ffffff'] });
        confetti({ particleCount: 80, spread: 80, startVelocity: 30, decay: 0.9, origin: { y: 0.4 }, scalar: 1.2, colors: ['#ffffff', '#eb5514'] });
      }, 300);
    }
  }, [finalWinner]);

  const inviteLink = typeof window !== 'undefined' && roomId ? `${window.location.origin}/classifiche/${id}?room=${roomId}` : '';

  return (
    <div style={{ zoom: 1.5 }}>
      <div className={`min-h-screen p-6 text-center font-['Press Gothic'] transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="flex justify-between items-center mb-6 relative">
          <button onClick={() => router.push('/')} className="hover:scale-110 transition-transform"><Home size={28} /></button>
          <img src="/criticoni.png" alt="Logo Criticoni" className="h-10 md:h-12" />
          <div className="relative">
            <button onClick={() => setIsDark(prev => !prev)} className="hover:scale-110 transition-transform mr-2">
              {isDark ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            <button onClick={() => setMenuOpen(prev => !prev)}>{menuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
            {menuOpen && (
              <div className={`absolute right-0 mt-2 w-64 p-4 rounded shadow-xl text-left z-50 ${isDark ? 'bg-neutral-900 text-white' : 'bg-white text-black'}`}>
                <p className="text-sm mb-2">🧩 Room ID: {roomId}</p>
                <p className="text-sm mb-2">🔗 Invita:
                  <input type="text" value={inviteLink} readOnly className="w-full mt-1 px-2 py-1 rounded text-xs bg-gray-100 text-black" />
                </p>
                <p className="text-sm mb-2">👤 Tu sei: {username}</p>
                <p className="mb-1 text-sm">👥 Partecipanti:</p>
                <ul className="list-disc ml-5 text-sm">{participants.map((user, i) => <li key={i}>{user}</li>)}</ul>
              </div>
            )}
          </div>
        </div>

        {/* Finale */}
        {showFinal && finalWinner ? (
          <div className="text-center p-8">
            <motion.h1 className="text-4xl text-orange-600 mb-6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
              Il Vincitore è:
            </motion.h1>
            <motion.img src={finalWinner.url} alt={finalWinner.name} className="mx-auto w-80 h-80 object-contain rounded-xl shadow-2xl border-8 border-[#eb5514]" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} />
            <p className="mt-4 text-2xl">{finalWinner.name}</p>
          </div>
        ) : currentPair.length < 2 ? (
          <p className="p-4">Caricamento scontri...</p>
        ) : (
          <>
            <h1 className="text-2xl mb-6">{title}</h1>
            <div className="flex justify-center items-center gap-6">
              <AnimatePresence mode="wait">
                {currentPair.map((img, i) => (
                  <motion.div
                    key={img.url}
                    initial={{ x: i === 0 ? -300 : 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={selectedImage?.url === img.url ? { x: i === 0 ? 100 : -100, scale: 1.1 } : { rotate: i === 0 ? -25 : 25, scale: 0.2, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`cursor-pointer transition-transform ${!selectedImage && 'hover:scale-105'}`}
                    onClick={() => handleVote(img)}
                  >
                    <motion.img src={img.url} alt={img.name} className={`w-48 h-48 md:w-64 md:h-64 object-contain rounded shadow-lg border-4 ${i === 0 ? 'border-[#eb5514]' : isDark ? 'border-white' : 'border-black'}`} />
                    <div className={`mt-2 px-2 py-1 rounded text-sm ${i === 0 ? 'bg-[#eb5514] text-white' : isDark ? 'bg-white text-black' : 'bg-black text-white'}`}>
                      {img.name}
                    </div>
                  </motion.div>
                ))}
                <motion.img src="/vs.png" alt="VS" className="w-12 md:w-16 h-auto" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 10 }} />
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
