"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  arrayUnion,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth, realtimeDb } from "@/lib/firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Home,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Maximize,
  Minimize,
  Search,
  X,
} from "lucide-react";
import {
  ref as rtdbRef,
  onValue,
  onDisconnect,
  set,
  remove,
} from "firebase/database";
import VideoFooter, { VideoFooterUser } from "@/components/VideoFooter";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ml-2 px-2 py-1 rounded bg-[#eb5514] text-white text-xs hover:bg-orange-700 transition"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      type="button"
      style={{ fontWeight: 400 }}
    >
      {copied ? "Copiato!" : "Copia link"}
    </button>
  );
}

type ImageItem = { url: string; name: string };
type RoomState = {
  roundImages: ImageItem[];
  currentPairIndex: number;
  winners: ImageItem[];
  finalWinner: ImageItem | null;
  showFinal: boolean;
  originalLength: number;
  pendingWinner?: ImageItem | null;
};

export default function Page() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [imagesLoading, setImagesLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [roundImages, setRoundImages] = useState<ImageItem[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [winners, setWinners] = useState<ImageItem[]>([]);
  const [finalWinner, setFinalWinner] = useState<ImageItem | null>(null);
  const [showFinal, setShowFinal] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [userUid, setUserUid] = useState("");
  const [hostUid, setHostUid] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentState, setCurrentState] = useState<RoomState | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<VideoFooterUser[]>([]);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const confettiLaunched = useRef(false);

  // FULLSCREEN BUTTON
  const [isFullscreen, setIsFullscreen] = useState(false);
  const handleToggleFullscreen = () => {
    const elem = document.documentElement;
    if (!isFullscreen) {
      if (elem.requestFullscreen) elem.requestFullscreen();
      else if ((elem as any).webkitRequestFullscreen)
        (elem as any).webkitRequestFullscreen();
      else if ((elem as any).msRequestFullscreen)
        (elem as any).msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen)
        (document as any).webkitExitFullscreen();
      else if ((document as any).msExitFullscreen)
        (document as any).msExitFullscreen();
    }
  };
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // WEBCAM ZOOM BUTTON
  const [webcamZoom, setWebcamZoom] = useState(false);

  const presenceRef = useRef<any>(null);
  const manualRemoveRef = useRef<(() => void) | null>(null);

  // --- Autenticazione + recupero username ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) router.push("/login");
      else {
        setUsername("");
        setUserUid(user.uid);
        // Recupera username da Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data()?.username || "");
        }
      }
      setAuthChecked(true);
    });
    return unsub;
  }, [router]);

  // --- Caricamento immagini ---
  useEffect(() => {
    if (!authChecked || !id) return;
    (async () => {
      try {
        const ref = doc(db, "classifiche", id as string);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setImagesLoading(false);
          setTimeout(() => setShowLoadingOverlay(false), 3000);
          return;
        }
        const data = snap.data();
        if (!data.images || !Array.isArray(data.images)) {
          setImagesLoading(false);
          setTimeout(() => setShowLoadingOverlay(false), 3000);
          return;
        }
        const shuffled = [...data.images].sort(() => Math.random() - 0.5) as ImageItem[];
        setTitle(data.title || "");
        let loaded = 0;
        const done = () => {
          loaded++;
          if (loaded === shuffled.length) {
            setRoundImages(shuffled);
            setImagesLoading(false);
            setTimeout(() => setShowLoadingOverlay(false), 3000);
          }
        };
        shuffled.forEach((img) => {
          const pre = new window.Image();
          pre.src = img.url;
          pre.onload = done;
          pre.onerror = done;
        });
      } catch {
        setImagesLoading(false);
        setTimeout(() => setShowLoadingOverlay(false), 3000);
      }
    })();
  }, [authChecked, id]);

  // --- JOIN / CREA STANZA + GESTIONE PRESENZA + ONLINE USERS ---
  useEffect(() => {
    if (!authChecked || !userUid) return;
    let unsub: (() => void) | null = null;
    let rtdbUnsubscribe: (() => void) | null = null;
    let disconnectObj: any = null;

    (async () => {
      const roomCode = searchParams.get("room");
      let roomKey = roomCode;

      if (roomCode) {
        const roomRef = doc(db, "stanze", roomCode as string);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) {
          setRoomNotFound(true);
          setTimeout(() => router.push("/"), 1700);
          return;
        }
        await updateDoc(roomRef, { partecipanti: arrayUnion(userUid) });
        setRoomId(roomCode as string);

        // --- PRESENZA ONLINE (RTDB) ---
        presenceRef.current = rtdbRef(realtimeDb, `presence/${roomCode}/${userUid}`);
        set(presenceRef.current, { uid: userUid, username, joinedAt: Date.now() });
        disconnectObj = onDisconnect(presenceRef.current);
        disconnectObj.remove();

        manualRemoveRef.current = () => {
          setTimeout(() => {
            if (presenceRef.current) remove(presenceRef.current);
          }, 0);
        };
        if (manualRemoveRef.current)
          window.addEventListener("beforeunload", manualRemoveRef.current);

        const presenceRoomRef = rtdbRef(realtimeDb, `presence/${roomCode}`);
        rtdbUnsubscribe = onValue(presenceRoomRef, async (snap) => {
          const val = snap.val() || {};
          const usersArr: VideoFooterUser[] = Object.values(val).map((v: any) => ({
            uid: v.uid,
            username: v.username || v.uid,
          }));
          setOnlineUsers(usersArr);

          if (usersArr.length === 0) {
            setRoomNotFound(true);
            setTimeout(() => router.push("/"), 1700);
            try {
              await deleteDoc(roomRef);
            } catch (err) {}
          }
        });

        unsub = onSnapshot(roomRef, (docSnap) => {
          if (!docSnap.exists()) {
            setRoomNotFound(true);
            setTimeout(() => router.push("/"), 1700);
            return;
          }
          const d = docSnap.data() as any;
          setHostUid(d.host);

          setCurrentState((prevState) => {
            const newState = d.state;
            setRoundImages(newState.roundImages);
            setCurrentPairIndex(newState.currentPairIndex);
            setWinners(newState.winners);
            setFinalWinner(newState.finalWinner);
            setShowFinal(newState.showFinal);
            return newState;
          });
        });

        return () => {
          if (manualRemoveRef.current)
            window.removeEventListener("beforeunload", manualRemoveRef.current);
          if (presenceRef.current) remove(presenceRef.current);
          if (disconnectObj && disconnectObj.cancel) disconnectObj.cancel();
          if (rtdbUnsubscribe) rtdbUnsubscribe();
          if (unsub) unsub();
        };
      }

      // CREA NUOVA STANZA SOLO SE NON C'È ROOM NEL LINK (sei tu l'host!)
      const ref2 = doc(db, "classifiche", id as string);
      const snap2 = await getDoc(ref2);
      if (snap2.exists()) {
        const data2 = snap2.data()!;
        if (data2.images) {
          const shuffled2 = [...data2.images].sort(() => Math.random() - 0.5) as ImageItem[];
          const newRoom = await addDoc(collection(db, "stanze"), {
            classificaId: id,
            partecipanti: [userUid],
            createdAt: new Date(),
            host: userUid,
            state: {
              roundImages: shuffled2,
              currentPairIndex: 0,
              winners: [],
              finalWinner: null,
              showFinal: false,
              originalLength: shuffled2.length,
              pendingWinner: null,
            },
          });
          setRoomId(newRoom.id);
          setHostUid(userUid);
          setRoundImages(shuffled2);
          router.replace(`?room=${newRoom.id}`);
          roomKey = newRoom.id;

          presenceRef.current = rtdbRef(realtimeDb, `presence/${roomKey}/${userUid}`);
          set(presenceRef.current, { uid: userUid, username, joinedAt: Date.now() });
          disconnectObj = onDisconnect(presenceRef.current);
          disconnectObj.remove();
          manualRemoveRef.current = () => {
            setTimeout(() => {
              if (presenceRef.current) remove(presenceRef.current);
            }, 0);
          };
          if (manualRemoveRef.current)
            window.addEventListener("beforeunload", manualRemoveRef.current);

          const presenceRoomRef = rtdbRef(realtimeDb, `presence/${roomKey}`);
          rtdbUnsubscribe = onValue(presenceRoomRef, async (snap) => {
            const val = snap.val() || {};
            const usersArr: VideoFooterUser[] = Object.values(val).map((v: any) => ({
              uid: v.uid,
              username: v.username || v.uid,
            }));
            setOnlineUsers(usersArr);

            if (usersArr.length === 0) {
              setRoomNotFound(true);
              setTimeout(() => router.push("/"), 1700);
              try {
                await deleteDoc(doc(db, "stanze", roomKey!));
              } catch (err) {}
            }
          });
          return () => {
            if (manualRemoveRef.current)
              window.removeEventListener("beforeunload", manualRemoveRef.current);
            if (presenceRef.current) remove(presenceRef.current);
            if (disconnectObj && disconnectObj.cancel) disconnectObj.cancel();
            if (rtdbUnsubscribe) rtdbUnsubscribe();
          };
        }
      }
    })();
  }, [authChecked, userUid, username, searchParams, id, router]);

  // --- SINCRONIZZA ANIMAZIONE DI SCALA E USCITA ---
  const state = currentState;
  const pendingWinner = state?.pendingWinner ?? null;
  const isHost = hostUid === userUid;
  const origLen = state?.originalLength || 0;
  const totalMatches = state ? ((state.roundImages.length / 2) | 0) : 0;
  const roundNum = state
    ? Math.ceil(Math.log2(origLen)) -
      Math.floor(Math.log2(state.roundImages.length)) +
      1
    : 0;
  const matchNum = state
    ? Math.floor(state.currentPairIndex / 2) + 1
    : 0;
  const currentPair = state
    ? state.roundImages.slice(state.currentPairIndex, state.currentPairIndex + 2)
    : [];

  // --- ANIMAZIONE DI VOTO SINCRONIZZATA ---
  useEffect(() => {
    if (!pendingWinner) return;
    setSelectedImage(pendingWinner);
    setIsTransitioning(true);
    const t = setTimeout(() => {
      setIsTransitioning(false);
      setSelectedImage(null);
      if (isHost && roomId && state && pendingWinner) {
        const isLast = state.currentPairIndex + 2 >= state.roundImages.length;
        const newW = [...state.winners, pendingWinner];
        const nextImgs = isLast && state.roundImages.length > 2 ? newW : state.roundImages;
        const nextIdx = isLast && state.roundImages.length > 2 ? 0 : state.currentPairIndex + 2;
        const nextWinners = isLast && state.roundImages.length > 2 ? [] : newW;
        const final = isLast && state.roundImages.length === 2;
        updateDoc(doc(db, "stanze", roomId), {
          state: {
            roundImages: nextImgs,
            currentPairIndex: nextIdx,
            winners: nextWinners,
            finalWinner: final ? pendingWinner : null,
            showFinal: final,
            originalLength: origLen,
            pendingWinner: null,
          },
        });
      }
      if (
        state?.showFinal &&
        state?.finalWinner &&
        state?.finalWinner.url === pendingWinner.url
      ) {
        if (!confettiLaunched.current) {
          confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 } });
          confettiLaunched.current = true;
        }
      }
    }, 450);
    return () => clearTimeout(t);
  }, [pendingWinner, isHost, roomId]);

  // --- CLICK: SOLO HOST, solo se non in animazione ---
  const handleVote = async (winner: ImageItem) => {
    if (!isHost || disabled || !state || isTransitioning || pendingWinner) return;
    setDisabled(true);
    if (roomId) {
      try {
        await updateDoc(doc(db, "stanze", roomId), {
          "state.pendingWinner": winner,
        });
      } catch (err) {
        console.warn("Errore in updateDoc torneo:", err);
      }
    }
    setTimeout(() => setDisabled(false), 500);
  };

  const isLoading = imagesLoading || showLoadingOverlay;
  const inviteLink = roomId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/classifiche/${id}?room=${roomId}`
    : "";

  const handleGoHome = async () => {
    if (manualRemoveRef.current)
      window.removeEventListener("beforeunload", manualRemoveRef.current);
    if (presenceRef.current) await remove(presenceRef.current);
    router.push("/");
  };

  if (roomNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white text-2xl font-bold">
        <span className="mb-6 animate-bounce">Stanza non trovata!</span>
        <span className="text-base font-normal animate-pulse">
          Verrai reindirizzato alla home...
        </span>
      </div>
    );
  }

  return (
    <div>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 pointer-events-auto transition-opacity duration-300">
          <span
            className="text-4xl font-bold text-white animate-pulse"
            style={{ letterSpacing: "2px" }}
          >
            CARICAMENTO...
          </span>
        </div>
      )}

      <div
        className={`min-h-screen text-center font-['Press Gothic'] transition-colors duration-300 ${
          isDark ? "bg-black text-white" : "bg-white text-black"
        } ${isLoading ? "pointer-events-none select-none filter blur-sm" : ""}`}
      >
        {/* HEADER */}
        <div
          className="flex items-center justify-between mb-12 px-8 pt-8 relative"
          style={{ minHeight: 80 }}
        >
          {/* Colonna sinistra */}
          <div
            style={{ width: 120, display: "flex", justifyContent: "flex-start" }}
          >
            <button
              onClick={handleGoHome}
              className="hover:scale-110 transition-transform"
              aria-label="Home"
            >
              <Home size={36} />
            </button>
          </div>
          {/* Logo centrale */}
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src="/criticoni.png"
              alt="Logo Criticoni"
              className="h-14 md:h-20"
              style={{ width: "auto", display: "block" }}
            />
          </div>
          {/* Colonna destra */}
          <div
            style={{
              width: 120,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              position: "relative",
            }}
          >
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
              {menuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {/* MENU UTENTE */}
            {menuOpen && (
              <div
                className={`absolute right-0 top-full mt-1 w-72 p-4 rounded shadow-xl z-50 ${
                  isDark ? "bg-neutral-900 text-white" : "bg-white text-black"
                }`}
                style={{
                  borderTop: "2px solid #eb5514",
                }}
              >
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-2 py-1 rounded bg-gray-100 text-black text-xs border border-[#eb5514]/40 select-all"
                      style={{ outline: "none", fontWeight: 400 }}
                    />
                    <CopyButton text={inviteLink} />
                  </div>
                </div>
                <div>
                  <ul className="mb-1 text-sm pl-0">
                    {onlineUsers.map((u) => (
                      <li
                        key={u.uid}
                        className={`
                          py-1 px-2 rounded
                          ${u.uid === hostUid ? "text-[#eb5514]" : "text-inherit"}
                          ${u.uid === userUid ? "bg-[#eb5514]/10" : ""}
                        `}
                        style={{ listStyle: "none", fontWeight: 400 }}
                      >
                        {u.username}
                        {u.uid === userUid ? " (tu)" : ""}
                        {u.uid === hostUid && " (host)"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TORNEO */}
        <div style={{ zoom: 1.12 }}>
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
                Round {roundNum} – Match {matchNum} di {totalMatches}
              </p>
              <div className="flex justify-center items-center gap-6 min-h-[300px] relative">
                {/* Prima Card */}
                <AnimatePresence mode="wait">
                  {currentPair[0] && (
                    <motion.div
                      key={currentPair[0].url + "-" + state?.currentPairIndex}
                      initial={{ x: -300, opacity: 0, scale: 1 }}
                      animate={{
                        x: 0,
                        opacity: 1,
                        scale:
                          isTransitioning && selectedImage
                            ? selectedImage.url === currentPair[0].url
                              ? 1.13
                              : 0.82
                            : 1,
                      }}
                      exit={{
                        opacity: 0,
                        transition: { duration: 0.36, ease: "easeInOut" },
                      }}
                      transition={{
                        duration: 0.32,
                        type: "spring",
                      }}
                      className={`${
                        isHost && !pendingWinner && !isTransitioning
                          ? "cursor-pointer hover:scale-105"
                          : "pointer-events-none opacity-60"
                      }`}
                      style={{
                        zIndex:
                          isTransitioning &&
                          selectedImage?.url === currentPair[0].url
                            ? 10
                            : undefined,
                      }}
                      onClick={
                        isHost && !isTransitioning && !pendingWinner
                          ? () => handleVote(currentPair[0])
                          : undefined
                      }
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
                  )}
                </AnimatePresence>

                {/* VS SEMPRE AL CENTRO */}
                <div className="flex flex-col justify-center items-center min-w-[70px] z-20">
                  <img src="/vs.png" alt="VS" className="w-12 h-12" />
                </div>

                {/* Seconda Card */}
                <AnimatePresence mode="wait">
                  {currentPair[1] && (
                    <motion.div
                      key={currentPair[1].url + "-" + state?.currentPairIndex}
                      initial={{ x: 300, opacity: 0, scale: 1 }}
                      animate={{
                        x: 0,
                        opacity: 1,
                        scale:
                          isTransitioning && selectedImage
                            ? selectedImage.url === currentPair[1].url
                              ? 1.13
                              : 0.82
                            : 1,
                      }}
                      exit={{
                        opacity: 0,
                        transition: { duration: 0.36, ease: "easeInOut" },
                      }}
                      transition={{
                        duration: 0.32,
                        type: "spring",
                      }}
                      className={`${
                        isHost && !pendingWinner && !isTransitioning
                          ? "cursor-pointer hover:scale-105"
                          : "pointer-events-none opacity-60"
                      }`}
                      style={{
                        zIndex:
                          isTransitioning &&
                          selectedImage?.url === currentPair[1].url
                            ? 10
                            : undefined,
                      }}
                      onClick={
                        isHost && !isTransitioning && !pendingWinner
                          ? () => handleVote(currentPair[1])
                          : undefined
                      }
                    >
                      <motion.img
                        src={currentPair[1].url}
                        alt={currentPair[1].name}
                        className={`w-48 h-48 md:w-64 md:h-64 object-contain rounded shadow-lg border-4 ${
                          isDark ? "border-white" : "border-black"
                        }`}
                      />
                      <div
                        className={`mt-2 px-2 py-1 rounded text-sm ${
                          isDark ? "bg-white text-black" : "bg-black text-white"
                        }`}
                      >
                        {currentPair[1].name}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* VIDEO FOOTER SEMPRE MONTATO */}
        <div
          className={`transition-all duration-400 ${
            webcamZoom
              ? "fixed inset-0 z-[201] flex items-center justify-center"
              : "fixed left-0 right-0 bottom-0 z-48 flex justify-center"
          }`}
          style={{
            gap: webcamZoom ? 50 : 30,
            padding: webcamZoom ? "0" : "10px 0 7px 0",
            transition: "all .38s cubic-bezier(.7,0,.3,1)",
            background: webcamZoom ? "rgba(0,0,0,0)" : "none",
            pointerEvents: "auto",
            ...(webcamZoom
              ? { maxHeight: "96vh", maxWidth: "98vw" }
              : {}),
          }}
        >
          <VideoFooter
            users={onlineUsers}
            roomId={roomId || ""}
            userUid={userUid}
            username={username}
            zoomed={webcamZoom}
            isDark={isDark}
          />
        </div>

        {/* TASTO X (CHIUDI ZOOM) */}
        {webcamZoom && (
          <button
            aria-label="Chiudi webcam maximizzata"
            onClick={() => setWebcamZoom(false)}
            className="fixed top-8 right-12 z-[300] hover:scale-110 transition"
            style={{
              background: "none",
              border: "none",
              outline: "none",
              color: isDark ? "#fff" : "#111",
              pointerEvents: "auto",
            }}
          >
            <X size={40} />
          </button>
        )}

        {/* Bottoni floating solo se NON zoom */}
        {!webcamZoom && (
          <div className="fixed bottom-7 right-7 flex flex-col items-end z-[100] gap-3">
            <button
              aria-label="Fullscreen"
              onClick={handleToggleFullscreen}
              style={{
                background: "none",
                border: "none",
                outline: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              {isFullscreen ? (
                <Minimize size={34} color={isDark ? "#fff" : "#111"} strokeWidth={2.2} />
              ) : (
                <Maximize size={34} color={isDark ? "#fff" : "#111"} strokeWidth={2.2} />
              )}
            </button>
            <button
              aria-label="Webcam Zoom"
              onClick={() => setWebcamZoom(true)}
              style={{
                background: "none",
                border: "none",
                outline: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <Search size={33} color={isDark ? "#fff" : "#111"} strokeWidth={2.1} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
