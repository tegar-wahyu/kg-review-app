"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Username atau password tidak valid.");
      return;
    }

    const data = (await res.json()) as { user: { role: "admin" | "expert" } };
    router.replace(data.user.role === "admin" ? "/admin" : "/review/available");
  };

  return (
    <main className="shell-center">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="faculty-logo-wrap" aria-hidden="true">
          <Image
            className="faculty-logo"
            src="/faculty-logo.png"
            alt="Logo fakultas"
            width={132}
            height={132}
            priority
          />
        </div>
        <h1>Validasi graf pengetahuan</h1>
        <p>Masuk menggunakan akun admin atau expert yang sudah diberikan.</p>

        <label>Nama pengguna</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />

        <label>Kata sandi</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <div className="error-box">{error}</div> : null}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Sedang masuk..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
