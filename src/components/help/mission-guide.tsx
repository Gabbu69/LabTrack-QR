"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Flag, BookOpen } from "lucide-react";
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
    <header className="mission-header"><div className="mission-kicker"><BookOpen aria-hidden="true" />LABTRACK HELP CENTER</div><h1>USER GUIDE</h1><p>Instructions for account access, tool checkout, returns, and reporting.</p><Link href="/login" className="button button-secondary">Back to sign in</Link></header>
    <fieldset className="mission-roles"><legend>1. Choose your role</legend>{(["student", "custodian", "instructor"] as const).map((item) => <label key={item} className={role === item ? "chosen" : ""}><input type="radio" name="guide-role" value={item} checked={role === item} onChange={() => setRole(item)} />{item === "student" ? "Student" : item === "custodian" ? "Tool custodian" : "Instructor"}</label>)}</fieldset>
    <section className="mission-progress" aria-label="Guide progress"><div><strong>2. Review the workflow instructions</strong><span>{count} / {missions[role].length} reviewed</span></div><progress value={count} max={missions[role].length} /><p>Reviewed sections are saved on this device. Marking a section does not change laboratory records.</p></section>
    <div className="mission-list">{missions[role].map((mission, index) => {
      const key = `${role}-${index}`; const done = completed.includes(key);
      return <article className={`mission-card${done ? " learned" : ""}`} key={key}>
        <div className="mission-number" aria-hidden="true">{done ? <Check /> : String(index + 1).padStart(2, "0")}</div>
        <div className="mission-body"><p className="mission-kicker">WORKFLOW {index + 1}</p><h2>{mission.title}</h2><ol>{mission.steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="mission-success"><Flag aria-hidden="true" /><span><strong>Expected result: </strong>{mission.success}</span></p><div className="mission-actions"><Link className="button button-secondary" href={mission.href}>Open this page</Link><button className="button button-primary" type="button" aria-pressed={done} disabled={!loaded} onClick={() => toggle(key)}>{done ? "Reviewed ✓ — undo" : "Mark as reviewed"}</button></div></div>
      </article>;
    })}</div>
    <aside className="mission-tip"><h2>Need help with a control?</h2><p>Press <strong>Help & user guide → Explain a control</strong>, then tap it. The highlighted control stays safe while you read. Close the guide to actually use it.</p><p>A gray button means you need to finish an earlier step or wait for a request. If a red message appears, read it before trying again.</p></aside>
  </main>;
}
