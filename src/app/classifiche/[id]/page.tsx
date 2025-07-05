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
  const [username, setUsername] = useState('')<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const confettiLaunched = useRef(false);

  useEffect(() => {
    async function fetchData() {
      const ref = doc(db, 'classifiche', id as string);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const shuffled = [...data.images].sort(() => Math.random() - 0.5);
        setRoundImages(shuffled);
        setTitle(data.title);
      }
    }
    fetchData();
  }, [id]);

  useEffect(() => {
    async function joinOrCreateRoom() {
      const roomFromUrl = searchParams.get('room');
      const name = prompt('Inserisci il tuo nome:');
      if (!name) return;
      setUsername(name);

      if (roomFromUrl) {
        const roomDoc = doc(db, 'stanze', roomFromUrl);
        const snap = await getDoc(roomDoc);
        if (snap.exists()) {
          await updateDoc(roomDoc, {
            partecipanti: arrayUnion(name),
          });
          setRoomId(roomFromUrl);
          return;
        }
      }

      const newRoomRef = await addDoc(collection(db, 'stanze'), {
        classificaId: id,
        partecipanti: [name],
        createdAt: serverTimestamp(),
      });
      setRoomId(newRoomRef.id);
      router.replace(`?room=${newRoomRef.id}`);
    }

    joinOrCreateRoom();
  }, [id]);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, 'stanze', roomId), (docSnap) => {
      const data = docSnap.data();
      if (data && data.partecipanti) {
        setParticipants(data.partecipanti);
      }
    });
    return () => unsub();
  }, [roomId]);

  const currentPair = roundImages.slice(currentPairIndex, currentPairIndex + 2);

  const handleVote = (winner: ImageItem) => {
    if (disabled) return;
    setSelectedImage(winner);
    setDisabled(true);

    setTimeout(() => {
      const newWinners = [...winners, winner];
      const isLastPair = currentPairIndex + 2 >= roundImages.length;

      if (isLastPair) {
        if (roundImages.length === 2) {
          setFinalWinner(winner);
        } else {
          setRoundImages(newWinners);
          setWinners([]);
          setCurrentPairIndex(0);
        }
      } else {
        setWinners(newWinners);
        setCurrentPairIndex((prev) => prev + 2);
      }

      setSelectedImage(null);
      setDisabled(false);
    }, 350);
  };

  useEffect(() => {
    if (finalWinner && !confettiLaunched.current) {
      confettiLaunched.current = true;
      setTimeout(() => {
        setShowFinal(true);
        confetti({
          particleCount: 100,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#eb5514', '#ffffff'],
        });
        confetti({
          particleCount: 80,
          spread: 80,
          startVelocity: 30,
          decay: 0.9,
          origin: { y: 0.4 },
          scalar: 1.2,
          colors: ['#ffffff', '#eb5514'],
        });
      }, 300);
    }
  }, [finalWinner]);

  const inviteLink =
    typeof window !== 'undefined' && roomId ? `${window.location.origin}/classifica/${id}?room=${roomId}` : '';

  return (
    <div style={{ zoom: 1.5 }}>
      <div
        className={`min-h-screen p-6 text-center font-['Press Gothic'] transition-colors duration-300 ${
          isDark ? 'bg-black text-white' : 'bg-white text-black'
        }`}
      >
        <div className="flex justify-between items-center mb-6 relative">
          <button onClick={() => router.push('/')} className="hover:scale-110 transition-transform">
            <Home size={28} />
          </button>

          <img src="/criticoni.png" alt="Logo Criticoni" className="h-10 md:h-12" />

          <div className="relative">
            <button onClick={() => setIsDark((prev) => !prev)} className="hover:scale-110 transition-transform mr-2">
              {isDark ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            <button onClick={() => setMenuOpen((prev) => !prev)}>
              {menuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {menuOpen && (
              <div
                className={`absolute right-0 mt-2 w-64 p-4 rounded shadow-xl text-left z-50 ${
                  isDark ? 'bg-neutral-900 text-white' : 'bg-white text-black'
                }`}
              >
                <p className="text-sm mb-2">
                  🧩 Room ID: {roomId}
                </p>
                <p className="text-sm mb-2">
                  🔗 Invita:
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="w-full mt-1 px-2 py-1 rounded text-xs bg-gray-100 text-black"
                  />
                </p>
                <p className="mb-1 text-sm">👥 Partecipanti:</p>
                <ul className="list-disc ml-5 text-sm">
                  {participants.map((user, i) => (
                    <li key={i}>{user}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {showFinal && finalWinner ? (
          <div className="text-center p-8">
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="text-4xl text-orange-600 mb-6"
            >
              Il Vincitore è:
            </motion.h1>
            <motion.img
              src={finalWinner.url}
              alt={finalWinner.name}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="mx-auto w-80 h-80 object-contain rounded-xl shadow-2xl border-8 border-[#eb5514]"
            />
            <p className="mt-4 text-2xl">{finalWinner.name}</p>
          </div>
        ) : finalWinner && !showFinal ? (
          <div className="flex justify-center items-center h-96">
            <AnimatePresence>
              <motion.div
                key="final-fade"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full"
              />
            </AnimatePresence>
          </div>
        ) : currentPair.length < 2 ? (
          <p className="p-4">Caricamento scontri...</p>
        ) : (
          <>
            <h1 className="text-2xl mb-6">{title}</h1>

            <div className="flex justify-center items-center gap-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPair[0].url}
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={
                    selectedImage?.url === currentPair[0].url
                      ? { x: 100, scale: 1.1, transition: { duration: 0.3 } }
                      : { rotate: -25, scale: 0.2, opacity: 0, transition: { duration: 0.3 } }
                  }
                  className={`cursor-pointer transition-transform ${!selectedImage && 'hover:scale-105'}`}
                  onClick={() => handleVote(currentPair[0])}
                >
                  <motion.img
                    src={currentPair[0].url}
                    alt={currentPair[0].name}
                    className="w-48 h-48 md:w-64 md:h-64 object-contain rounded shadow-lg border-4 border-[#eb5514]"
                  />
                  <div className="mt-2 px-2 py-1 rounded text-sm bg-[#eb5514] text-white">
                    {currentPair[0].name}
                  </div>
                </motion.div>

                <motion.img
                  src="/vs.png"
                  alt="VS"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                  className="w-12 md:w-16 h-auto"
                />

                <motion.div
                  key={currentPair[1].url}
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={
                    selectedImage?.url === currentPair[1].url
                      ? { x: -100, scale: 1.1, transition: { duration: 0.3 } }
                      : { rotate: 25, scale: 0.2, opacity: 0, transition: { duration: 0.3 } }
                  }
                  className={`cursor-pointer transition-transform ${!selectedImage && 'hover:scale-105'}`}
                  onClick={() => handleVote(currentPair[1])}
                >
                  <motion.img
                    src={currentPair[1].url}
                    alt={currentPair[1].name}
                    className={`w-48 h-48 md:w-64 md:h-64 object-contain rounded shadow-lg border-4 ${
                      isDark ? 'border-white' : 'border-black'
                    }`}
                  />
                  <div
                    className={`mt-2 px-2 py-1 rounded text-sm ${
                      isDark ? 'bg-white text-black' : 'bg-black text-white'
                    }`}
                  >
                    {currentPair[1].name}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
