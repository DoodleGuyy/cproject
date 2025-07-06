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
  deleteDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Home, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';

type ImageItem = {
  url: string;
  name: string;
};

type RoomState = {
  roundImages: ImageItem[];
  currentPairIndex: number;
  winners: ImageItem[];
  finalWinner: ImageItem | null;
  showFinal: boolean;
  originalLength: number;
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
  const [username, setUsername] = useState<string>('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [host, setHost] = useState(false);
  const [currentState, setCurrentState] = useState<RoomState | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const confettiLaunched = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setUsername(user.email ?? '');
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;

    async function fetchData() {
      const ref = doc(db, 'classifiche', id as string);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.images) {
          const shuffled = [...data.images].sort(() => Math.random() - 0.5);
          setRoundImages(shuffled);
          setTitle(data.title);
        }
      }
    }
    fetchData();
  }, [id, authChecked]);

  useEffect(() => {
    if (!authChecked || !username || joined) return;

    async function joinRoom() {
      setJoined(true);

      const roomFromUrl = searchParams.get('room');
      const name = username;

      if (roomFromUrl) {
        const roomDocRef = doc(db, 'stanze', roomFromUrl);
        const snap = await getDoc(roomDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (!data?.host) {
            await updateDoc(roomDocRef, { host: name });
            setHost(true);
          } else {
            setHost(data.host === name);
          }

          await updateDoc(roomDocRef, {
            partecipanti: arrayUnion(`${name} (host)`),
          });

          setRoomId(roomFromUrl);

          const removeFromRoom = () => {
  if (roomDocRef) {
    updateDoc(roomDocRef, {
      partecipanti: arrayRemove(name),
    }).catch((err) => console.error('Errore rimozione partecipante:', err));
  }
};

window.addEventListener('beforeunload', removeFromRoom);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    removeFromRoom();
  }
});


          onSnapshot(roomDocRef, async (docSnap) => {
            const data = docSnap.data();
            if (data?.partecipanti) {
    setParticipants(data.partecipanti);

    // 🧹 Auto-elimina la stanza se vuota e sei l'host
    if (data.partecipanti.length === 0 && data.host === username) {
      try {
        await deleteDoc(roomDocRef);
        console.log('✅ Stanza eliminata automaticamente perché vuota.');
      } catch (error) {
        console.error('❌ Errore durante la cancellazione della stanza:', error);
      }
    }
  }











            if (data?.state) {
              setCurrentState(data.state as RoomState);
              setRoundImages(data.state.roundImages);
              setCurrentPairIndex(data.state.currentPairIndex);
              setWinners(data.state.winners);
              setFinalWinner(data.state.finalWinner);
              setShowFinal(data.state.showFinal);
            }
          });

          return;
        }
      }

      const ref = doc(db, 'classifiche', id as string);
      const snap = await getDoc(ref);
      const data = snap.data();
      if (data && data.images) {
        const shuffled = [...data.images].sort(() => Math.random() - 0.5);
        const newRoomRef = await addDoc(collection(db, 'stanze'), {
          classificaId: id,
          partecipanti: [`${name} (host)`],
          createdAt: serverTimestamp(),
          host: name,
          state: {
            roundImages: shuffled,
            currentPairIndex: 0,
            winners: [],
            finalWinner: null,
            showFinal: false,
            originalLength: shuffled.length,
          },
        });
        setRoomId(newRoomRef.id);
        setHost(true);
        setRoundImages(shuffled);
        router.replace(`?room=${newRoomRef.id}`);
      }
    }

    joinRoom();
  }, [authChecked, id, searchParams, joined, router, username]);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, 'stanze', roomId), (docSnap) => {
      const data = docSnap.data();
      if (data?.partecipanti) {
        setParticipants(data.partecipanti);
      }
    });
    return () => unsub();
  }, [roomId]);

  const currentPair = roundImages.slice(currentPairIndex, currentPairIndex + 2);
  const originalLength = currentState?.originalLength || roundImages.length || 1;
  const totalRounds = Math.ceil(Math.log2(originalLength));
  const currentRoundLength = roundImages.length;
  const currentRound = totalRounds - Math.floor(Math.log2(currentRoundLength)) + 1;
  const currentMatch = Math.floor(currentPairIndex / 2) + 1;
  const totalMatches = currentRoundLength / 2;

  const handleVote = async (winner: ImageItem) => {
    if (!host || disabled) return;
    setSelectedImage(winner);
    setDisabled(true);

    const isLastPair = currentPairIndex + 2 >= roundImages.length;
    const newWinners = [...winners, winner];
    const nextRoundImages = isLastPair && roundImages.length > 2 ? newWinners : roundImages;
    const nextPairIndex = isLastPair && roundImages.length > 2 ? 0 : currentPairIndex + 2;
    const nextWinners = isLastPair && roundImages.length > 2 ? [] : newWinners;
    const isFinal = isLastPair && roundImages.length === 2;

    setTimeout(async () => {
      if (isFinal) {
        setFinalWinner(winner);
        setShowFinal(true);
        if (!confettiLaunched.current) {
          confettiLaunched.current = true;
          confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 }, colors: ['#eb5514', '#ffffff'] });
        }
      } else {
        setRoundImages(isLastPair ? newWinners : roundImages);
        setWinners(nextWinners);
        setCurrentPairIndex(nextPairIndex);
      }

      setSelectedImage(null);
      setDisabled(false);

      if (roomId) {
        await updateDoc(doc(db, 'stanze', roomId), {
          state: {
            roundImages: nextRoundImages,
            currentPairIndex: nextPairIndex,
            winners: nextWinners,
            finalWinner: isFinal ? winner : null,
            showFinal: isFinal,
            originalLength,
          },
        });
      }
    }, 400);
  };

  const inviteLink =
    typeof window !== 'undefined' && roomId
      ? `${window.location.origin}/classifiche/${id}?room=${roomId}`
      : '';

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
                <p className="text-sm mb-2">🧩 Room ID: {roomId}</p>
                <p className="text-sm mb-2">
                  🔗 Invita:
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="w-full mt-1 px-2 py-1 rounded text-xs bg-gray-100 text-black"
                  />
                </p>
                <p className="text-sm mb-2">👤 Tu sei: {username}</p>
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
        ) : currentPair.length < 2 ? (
          <p className="p-4">Caricamento scontri...</p>
        ) : (
          <>
            <h1 className="text-2xl mb-2">{title}</h1>
            <p className="mb-4 text-sm">
              Round {currentRound} – Match {currentMatch} di {totalMatches}
            </p>

            <div className="flex justify-center items-center gap-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPair[0].url}
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{
                    rotate: selectedImage?.url === currentPair[0].url ? 0 : -25,
                    scale: selectedImage?.url === currentPair[0].url ? 1.1 : 0.2,
                    opacity: 0,
                    transition: { duration: 0.3 },
                  }}
                  className={`cursor-pointer ${!selectedImage && 'hover:scale-105'}`}
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

                <div className="flex flex-col justify-center items-center">
                  <motion.img
                    src="/vs.png"
                    alt="VS"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                    className="w-12 h-12"
                  />
                </div>

                <motion.div
                  key={currentPair[1].url}
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{
                    rotate: selectedImage?.url === currentPair[1].url ? 0 : 25,
                    scale: selectedImage?.url === currentPair[1].url ? 1.1 : 0.2,
                    opacity: 0,
                    transition: { duration: 0.3 },
                  }}
                  className={`cursor-pointer ${!selectedImage && 'hover:scale-105'}`}
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
