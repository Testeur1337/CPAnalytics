"use client";

import { useState } from "react";

export default function CreatePage() {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    destinationA: "",
    destinationB: "",
    weightA: 100,
    weightB: 0,
    tags: ""
  });
  const [result, setResult] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult("Saving...");
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        destinationB: form.destinationB || null,
        tags: form.tags || null
      })
    });
    const data = await res.json();
    setResult(res.ok ? `Created link: ${data.link.slug}` : `Error: ${data.error}`);
  }

  return (
    <main className="grid" style={{ gap: "1rem" }}>
      <h1>Create Tracking Link</h1>
      <form className="card grid" onSubmit={onSubmit}>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></label>
        <label>Destination A<input value={form.destinationA} onChange={(e) => setForm({ ...form, destinationA: e.target.value })} required /></label>
        <label>Destination B<input value={form.destinationB} onChange={(e) => setForm({ ...form, destinationB: e.target.value })} /></label>
        <div className="grid grid-2">
          <label>Weight A<input type="number" value={form.weightA} onChange={(e) => setForm({ ...form, weightA: Number(e.target.value) })} /></label>
          <label>Weight B<input type="number" value={form.weightB} onChange={(e) => setForm({ ...form, weightB: Number(e.target.value) })} /></label>
        </div>
        <label>Tags<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></label>
        <button type="submit">Create Link</button>
      </form>
      {result && <div className="card">{result}</div>}
    </main>
  );
}
