"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Benvenuto in ProjectCritics</h1>

      <button
        onClick={() => router.push("/create")}
        style={{ padding: "0.5rem 1rem", fontSize: "1.2rem", cursor: "pointer", marginTop: "1rem", marginRight: "1rem" }}
      >
        Crea Classifica
      </button>

      <button
        onClick={() => router.push("/classifiche")}
        style={{ padding: "0.5rem 1rem", fontSize: "1.2rem", cursor: "pointer", marginTop: "1rem" }}
      >
        Classifiche
      </button>
    </main>
  );
}

