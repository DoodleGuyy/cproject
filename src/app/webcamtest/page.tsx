// components/VideoFooter.tsx
import React, { useEffect, useRef, useState } from "react";

export type VideoFooterUser = {
  uid: string;
  username: string;
};

type Props = {
  users: VideoFooterUser[];
  roomId: string;
  userUid: string;
  username: string;
};

type DeviceInfo = { deviceId: string; label: string };

export default function VideoFooter({
  users,
  roomId,
  userUid,
  username,
}: Props) {
  return (
    <footer
      style={{
        marginTop: 40,
        padding: 0,
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 28,
          justifyContent: "center",
          alignItems: "flex-end",
        }}
      >
        {users.map((u) => (
          <VideoBox
            key={u.uid}
            user={u}
            isSelf={u.uid === userUid}
            username={u.username}
          />
        ))}
      </div>
    </footer>
  );
}

function VideoBox({
  user,
  isSelf,
  username,
}: {
  user: VideoFooterUser;
  isSelf: boolean;
  username: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [active, setActive] = useState(false);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  // Carica le webcam disponibili
  useEffect(() => {
    if (!isSelf) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => {
        setDevices(
          list
            .filter((d) => d.kind === "videoinput")
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || "Fotocamera",
            }))
        );
      })
      .catch(() => setDevices([]));
  }, [isSelf]);

  // Avvia/aggiorna lo stream webcam
  useEffect(() => {
    if (!isSelf || !active) return;
    let stream: MediaStream | null = null;

    const getStream = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        alert("Impossibile accedere alla webcam.");
      }
    };
    getStream();

    // Cleanup: spegni webcam quando disattivi
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
    // eslint-disable-next-line
  }, [active, deviceId, isSelf]);

  return (
    <div
      style={{
        width: 240,
        aspectRatio: "16/9",
        borderRadius: 14,
        boxShadow: "0 3px 24px #0003",
        background: "#222",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        justifyContent: "flex-end",
      }}
    >
      {/* Video webcam (solo per se stessi se attiva) */}
      {isSelf && active ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 14,
            background: "#111",
          }}
        />
      ) : null}

      {/* Placeholder grigio */}
      {!active || !isSelf ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#444",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 46,
            color: "#fff7",
            fontWeight: 500,
            letterSpacing: 1,
            position: "absolute",
            left: 0,
            top: 0,
          }}
        >
          <span role="img" aria-label="Webcam">📷</span>
        </div>
      ) : null}

      {/* Comandi solo per il proprio riquadro */}
      {isSelf && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 0,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2,
            pointerEvents: "auto",
          }}
        >
          {!active ? (
            <button
              onClick={() => setActive(true)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "#eb5514",
                color: "#fff",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                marginRight: 7,
                boxShadow: "0 1px 8px #0004",
              }}
            >
              Attiva webcam
            </button>
          ) : (
            <>
              {devices.length > 1 && (
                <select
                  value={deviceId || ""}
                  onChange={(e) => setDeviceId(e.target.value)}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #aaa",
                    marginRight: 6,
                    padding: "4px 6px",
                    fontSize: 14,
                  }}
                >
                  <option value="">Predefinita</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Webcam"}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setActive(false)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  background: "#444",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Spegni
              </button>
            </>
          )}
        </div>
      )}

      {/* Nome sotto il video */}
      <div
        style={{
          position: "absolute",
          bottom: -28,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 15,
          color: "#fff",
          fontWeight: 500,
          textShadow: "0 1px 6px #000",
          letterSpacing: 0.5,
          zIndex: 2,
          userSelect: "none",
        }}
      >
        {username}
      </div>
    </div>
  );
}
