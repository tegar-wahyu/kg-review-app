"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type SessionUser = { username: string; role: "admin" | "expert" };

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as { user: SessionUser };
      router.replace(data.user.role === "admin" ? "/admin" : "/review/available");
    };
    run();
  }, [router]);

  return <div style={{ padding: "2rem", textAlign: "center" }}>Memuat...</div>;
}
