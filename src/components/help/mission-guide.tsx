"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Flag, Gamepad2 } from "lucide-react";
import { missions, type GuideRole } from "@/lib/guide-missions";

export function MissionGuide() {
  const [role, setRole] = useState<GuideRole>("student");
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("labtrack-missions-v1") ?? "[]");
      if (Array.isArray(saved)) setCompleted(saved.filter((item): item is string => typeof item === "string"));
    } catch { /* Lessons remain usable when storage is unavailable. */ }
    setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  function toggle(key: string) {
    const next = completed.includes(key) ? completed.filter((item) => item !== key) : [...completed, key];
    setCompleted(next);
    try { localStorage.setItem("labtrack-missions-v1", JSON.stringify(next)); } catch { /* Optional progress. */ }
  }
  const count = missions[role].filter((_, index) => completed.includes(`${role}-${index}`)).length;
  return <main className="mission-page">
    <header className="mission-header"><div className="mission-kicker"><Gamepad2 aria-hidden="true" />LABTRACK FIELD GUIDE</div><h1>HOW TO PLAY</h1><p>One mission at a time. Learn the buttons, then try the real steps.</p><Link href="/login" className="button button-secondary">Back to sign in</Link></header>
    <fieldset className="mission-roles"><legend>1. Choose your role</legend>{(["student", "custodian", "instructor"] as const).map((item) => <label key={item} className={role === item ? "chosen" : ""}><input type="radio" name="guide-role" value={item} checked={role === item} onChange={() => setRole(item)} />{item === "student" ? "Student" : item === "custodian" ? "Tool custodian" : "Instructor"}</label>)}</fieldset>
    <section className="mission-progress" aria-label="Learning progress"><div><strong>2. Complete your training missions</strong><span>{count} / {missions[role].length} learned</span></div><progress value={count} max={missions[role].length} /><p>Checkmarks save on this device. They track your learning only; they do not create accounts or move tools.</p></section>
    <div className="mission-list">{missions[role].map((mission, index) => {
      const key = `${role}-${index}`; const done = completed.includes(key);
      return <article className={`mission-card${done ? " learned" : ""}`} key={key}>
        <div className="mission-number" aria-hidden="true">{done ? <Check /> : String(index + 1).padStart(2, "0")}</div>
        <div className="mission-body"><p className="mission-kicker">MISSION {index + 1}</p><h2>{mission.title}</h2><ol>{mission.steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="mission-success"><Flag aria-hidden="true" /><span><strong>You did it when: </strong>{mission.success}</span></p><div className="mission-actions"><Link className="button button-secondary" href={mission.href}>Open this page</Link><button className="button button-primary" type="button" aria-pressed={done} disabled={!loaded} onClick={() => toggle(key)}>{done ? "Learned ✓ — undo" : "I learned this"}</button></div></div>
      </article>;
    })}</div>
    <aside className="mission-tip"><h2>Stuck on a button?</h2><p>Press <strong>How to play → Explain a control</strong>, then tap it. The highlighted control stays safe while you read. Close the guide to actually use it.</p><p>A gray button means you need to finish an earlier step or wait for a request. If a red message appears, read it before trying again.</p></aside>
  </main>;
}
