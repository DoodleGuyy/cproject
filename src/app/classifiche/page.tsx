"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebaseConfig";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";

type Classifica = {
  id: string;
  title: string;
};

export default function ClassifichePage() {
  const [classifiche, setClassifiche] = useState<Classifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  if (loading) return <p>Caricamento classifiche...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (classifiche.length === 0) return <p>Nessuna classifica trovata.</p>;

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "auto" }}>
      <h1>Classifiche</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {classifiche.map(({ id, title }) => (
          <li key={id} style={{ marginBottom: "1rem" }}>
            <button
              onClick={() => router.push(`/classifiche/${id}`)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "blue",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: "1.2rem",
              }}
            >
              {title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
