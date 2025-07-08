"use client";

import React, { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";
import {
  ref as rtdbRef,
  set,
  onChildAdded,
  remove,
} from "firebase/database";
import { realtimeDb } from "@/lib/firebaseConfig";

export type VideoFooterUser = {
  uid: string;
  username: string;
};

type Props = {
  users: VideoFooterUser[];
  roomId: string;
  userUid: string;
  username: string;
  zoomed?: boolean;
  isDark?: boolean; // <--- aggiunta prop per light/dark mode
};

type RemoteVideo = {
  uid: string;
  username: string;
  stream?: MediaStream;
};

function cleanObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  } else if (obj !== null && typeof obj === "object") {
    return Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: cleanObject(v) }), {});
  }
  return obj;
}

const ORANGE = "#eb5514";
const DARK_BORDERCOLOR = "#eb5514";
const LIGHT_BORDERCOLOR = "#222";
const DARK_BUTTON = "#eb5514";
const LIGHT_BUTTON = "#222";

const VideoFooter: React.FC<Props> = ({
  users,
  roomId,
  userUid,
  username,
  zoomed = false,
  isDark = true,
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCamActive, setIsCamActive] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const peersRef = useRef<Record<string, SimplePeer.Instance>>({});
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);
  const [switchingCam, setSwitchingCam] = useState(false);

  const signalsPath = `rooms_signals/${roomId}`;

  // Pulizia segnali utente all'ingresso stanza
  useEffect(() => {
    if (!roomId || !userUid) return;
    remove(rtdbRef(realtimeDb, `${signalsPath}/${userUid}`));
  }, [roomId, userUid]);

  // Aggiorna lista device video quando cam attiva
  useEffect(() => {
    if (!isCamActive) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((d) =>
        setDevices(d.filter((dev) => dev.kind === "videoinput"))
      );
  }, [isCamActive]);

  // Attiva webcam solo al click (come W2G)
  const startCam = async (deviceId?: string) => {
    try {
      if (localStream || switchingCam) return;
      setSwitchingCam(true);
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCamActive(true);
    } catch (err) {
      alert("Permesso webcam negato o dispositivo non trovato.");
      setIsCamActive(false);
    } finally {
      setSwitchingCam(false);
    }
  };

  // Disattiva webcam e ferma stream
  const stopCam = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setIsCamActive(false);
  };

  // Peer mesh: connessione fissa
  useEffect(() => {
    if (!roomId || !userUid) return;

    // Chiudi peer per utenti usciti
    Object.keys(peersRef.current).forEach((uid) => {
      if (uid !== userUid && !users.find((u) => u.uid === uid)) {
        peersRef.current[uid]?.destroy?.();
        delete peersRef.current[uid];
        setRemoteVideos((v) => v.filter((rv) => rv.uid !== uid));
      }
    });

    // Funzione invio segnale
    const sendSignalTo = async (toUid: string, signal: any) => {
      const msg = { from: userUid, signal: cleanObject(signal) };
      const newKey = Math.random().toString(36).slice(2);
      await set(
        rtdbRef(realtimeDb, `${signalsPath}/${toUid}/${userUid}_${newKey}`),
        msg
      );
    };

    // Crea peer verso ogni altro utente
    users.forEach((u) => {
      if (u.uid === userUid) return;
      if (peersRef.current[u.uid]) return;

      const initiator = userUid < u.uid;
      const peer = new SimplePeer({
        initiator,
        trickle: true,
      });

      peer.on("signal", (data) => sendSignalTo(u.uid, data));

      peer.on("stream", (stream) => {
        setRemoteVideos((prev) => {
          const idx = prev.findIndex((rv) => rv.uid === u.uid);
          if (idx !== -1)
            return prev.map((rv) =>
              rv.uid === u.uid ? { ...rv, stream } : rv
            );
          else
            return [...prev, { uid: u.uid, username: u.username, stream }];
        });
      });

      peer.on("close", () => {
        setRemoteVideos((prev) => prev.filter((rv) => rv.uid !== u.uid));
      });

      peersRef.current[u.uid] = peer;
    });

    // Cleanup peer all'uscita
    return () => {
      Object.values(peersRef.current).forEach((p) => p.destroy?.());
      peersRef.current = {};
      setRemoteVideos([]);
      remove(rtdbRef(realtimeDb, `${signalsPath}/${userUid}`));
    };
  }, [users, roomId, userUid]);

  // Listener segnali destinati a me
  useEffect(() => {
    if (!roomId || !userUid) return;
    const ref = rtdbRef(realtimeDb, `${signalsPath}/${userUid}`);
    const unsub = onChildAdded(ref, (snap) => {
      const data = snap.val();
      const fromUid = data?.from;
      if (!fromUid || !data.signal) {
        remove(snap.ref);
        return;
      }
      const peer = peersRef.current[fromUid];
      if (peer && !peer.destroyed) {
        try {
          peer.signal(data.signal);
        } catch (e) {}
      }
      remove(snap.ref);
    });
    return () => unsub();
  }, [roomId, userUid, users]);

  // FIX: Aggancia/rimuovi traccia video su peer quando attivi/disattivi webcam
  useEffect(() => {
    Object.values(peersRef.current).forEach((peer) => {
      const p = peer as any;
      const pc: RTCPeerConnection = p._pc;
      const localTrack = localStream?.getVideoTracks?.()[0];

      // Cerca il sender video
      const videoSender = pc.getSenders().find(
        (sender) => sender.track && sender.track.kind === "video"
      );

      if (localTrack && !videoSender) {
        pc.addTrack(localTrack, localStream!);
        if (p._needsNegotiation) p._needsNegotiation();
      } else if (!localTrack && videoSender) {
        videoSender.replaceTrack(null);
        if (p._needsNegotiation) p._needsNegotiation();
      } else if (localTrack && videoSender && videoSender.track !== localTrack) {
        videoSender.replaceTrack(localTrack);
        if (p._needsNegotiation) p._needsNegotiation();
      }
    });
  }, [localStream, users.length]);

  // Cambio webcam device
  useEffect(() => {
    if (selectedDeviceId) {
      stopCam();
      setTimeout(() => startCam(selectedDeviceId), 200);
    }
    // eslint-disable-next-line
  }, [selectedDeviceId]);

  // Riquadri da mostrare
  const allToShow: (RemoteVideo & { isLocal?: boolean })[] = [
    {
      uid: userUid,
      username,
      stream: localStream || undefined,
      isLocal: true,
    },
    ...users
      .filter((u) => u.uid !== userUid)
      .map((u) => {
        const found = remoteVideos.find((rv) => rv.uid === u.uid);
        return {
          uid: u.uid,
          username: u.username,
          stream: found?.stream,
        };
      }),
  ];

  // Layout e animazione per zoomed
  const borderColor = isDark ? DARK_BORDERCOLOR : LIGHT_BORDERCOLOR;
  const buttonColor = isDark ? DARK_BUTTON : LIGHT_BUTTON;
  const buttonTextColor = "#fff";

  const containerStyle: React.CSSProperties = zoomed
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        background: isDark ? "rgba(0,0,0,0.95)" : "#fff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 40,
        transition: "all 0.33s cubic-bezier(.86,.01,.32,1)",
        pointerEvents: "auto",
      }
    : {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 48,
        padding: "10px 0 7px 0",
        display: "flex",
        justifyContent: "center",
        gap: 30,
        transition: "all 0.33s cubic-bezier(.86,.01,.32,1)",
        pointerEvents: "auto",
      };

  return (
    <div style={containerStyle}>
      {allToShow.map((u) => (
        <div
          key={u.uid}
          onMouseEnter={() => setHoveredUid(u.uid)}
          onMouseLeave={() => setHoveredUid(null)}
          style={{
            width: zoomed ? 420 : 210,
            aspectRatio: "16/9",
            background: u.stream
              ? isDark ? "#222" : "#f1f1f1"
              : isDark
              ? "linear-gradient(125deg,#232323 65%,#2e1810 100%)"
              : "linear-gradient(125deg,#ececec 65%,#dadada 100%)",
            border: `3px solid ${borderColor}`,
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            transition: "box-shadow .2s, width .33s cubic-bezier(.86,.01,.32,1), border-color .2s",
            boxShadow:
              hoveredUid === u.uid && !zoomed
                ? "0 0 0 2px #fff8, 0 5px 25px #000c"
                : zoomed
                ? "0 2px 50px #000d"
                : "0 1.5px 8px #0006",
            cursor: u.isLocal ? "pointer" : "default",
            margin: zoomed ? "12px" : undefined,
            maxWidth: zoomed ? "96vw" : undefined,
            minWidth: zoomed ? 220 : undefined,
          }}
        >
          {u.stream ? (
            <video
              ref={(el) => {
                if (el && u.stream) {
                  el.srcObject = u.stream;
                  el.muted = !!u.isLocal;
                  el.autoplay = true;
                  el.playsInline = true;
                }
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                background: "#000",
                display: "block",
                borderRadius: 16,
                transition: "all 0.33s cubic-bezier(.86,.01,.32,1)",
              }}
            />
          ) : (
            <span
              style={{
                color: isDark ? "#fff" : "#111",
                fontWeight: "bold",
                fontSize: zoomed ? 34 : 20,
                textShadow: isDark ? "0 2px 8px #000a" : "none",
                textAlign: "center",
                padding: zoomed ? "24px 0" : undefined,
                transition:
                  "font-size 0.33s cubic-bezier(.86,.01,.32,1), padding 0.33s cubic-bezier(.86,.01,.32,1), color .2s",
              }}
            >
              {u.username}
            </span>
          )}

          {/* Overlay per il proprio riquadro */}
          {u.isLocal && hoveredUid === u.uid && !zoomed && (
            <div
              style={{
                position: "absolute",
                inset: 0,

                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              {isCamActive ? (
                <button
                  onClick={stopCam}
                  style={{
                    background: buttonColor,
                    color: buttonTextColor,
                    border: "none",
                    borderRadius: 8,
          
                    fontSize: 16,
                    padding: "8px 24px",
                    cursor: "pointer",
                    boxShadow: isDark
                      ? "0 1.5px 12px #0008"
                      : "0 1.5px 10px #bbb8",
                  }}
                  disabled={switchingCam}
                >
                  Disattiva webcam
                </button>
              ) : (
                <button
                  onClick={() => startCam(selectedDeviceId)}
                  style={{
                    background: buttonColor,
                    color: buttonTextColor,
                    border: "none",
                    borderRadius: 8,
        
                    fontSize: 16,
                    padding: "8px 24px",
                    cursor: "pointer",
                    boxShadow: isDark
                      ? "0 1.5px 12px #0008"
                      : "0 1.5px 10px #bbb8",
                  }}
                  disabled={switchingCam}
                >
                  Attiva webcam
                </button>
              )}
              {isCamActive && devices.length > 1 && (
                <select
                  style={{
                    marginTop: 7,
                    background: "#fff",
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: 7,
                    fontSize: 14,
                    padding: "5px 9px",
                    minWidth: 100,
                  }}
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  disabled={switchingCam}
                >
                  <option value="">Predefinita</option>
                  {devices.map((dev) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label || `Webcam (${dev.deviceId.slice(0, 7)})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default VideoFooter;
