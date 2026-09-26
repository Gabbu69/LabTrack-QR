"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleHelp, MousePointer2, Play, X } from "lucide-react";
import { describeControl, describePage } from "@/lib/control-help";
import { pageMission } from "@/lib/guide-missions";

const selector = "button, a[href], summary, input:not([type=hidden]), select, textarea";
type Control = { element: HTMLElement; label: string; description: string; result: string };

function controlInfo(element: HTMLElement): Control {
  const field = element as HTMLInputElement;
  const label = (element.getAttribute("aria-label") || field.labels?.[0]?.textContent || element.textContent || element.getAttribute("placeholder") || "Control").replace(/\s+/g, " ").trim();
  const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName);
  const description = element.dataset.help || (isField
    ? field.type === "checkbox" ? `Tick ${label.toLowerCase()} to select it. Tap again to undo your selection.`
      : field.type === "file" ? "Choose a clear image from your device. QR images must show the whole code. Profile photos must be JPG, PNG or WebP, up to 2 MB."
      : `${element.tagName === "SELECT" ? "Choose" : "Enter"} ${label.toLowerCase()}.${field.required ? " Do not leave this field blank." : ""}${field.type === "password" ? " Keep this value private." : ""}${field.placeholder ? ` Example or hint: ${field.placeholder}.` : ""}`
    : element.tagName === "SUMMARY" ? `Tap to open this section. ${element.closest(".transaction-row") ? "Read the tools, conditions and return notes inside. Tap the row again to close it." : describeControl(label, null)}`
    : describeControl(label, element.getAttribute("href")));
  const result = isField ? "Your choice stays in the form. Use its submit or save button when you have finished."
    : element.tagName === "SUMMARY" ? "Shows or hides more details. Opening a section does not save changes."
    : element.tagName === "A" ? (element.getAttribute("href")?.includes("transactions.csv") ? "Downloads the matching records as a CSV spreadsheet." : "Opens the linked page. Follow the instructions on that page.")
    : /confirm checkout/i.test(label) ? "Creates a borrowing record and marks the scanned tools as Borrowed."
    : /confirm return/i.test(label) ? "Saves the return of scanned tools. Unscanned tools stay outstanding."
    : /sign in/i.test(label) ? "Checks your account and opens your dashboard when sign-in succeeds."
    : /registration/i.test(label) ? "Creates a pending student account when registration succeeds."
    : /remove |^change$/i.test(label) ? "Changes only the current selection; no stored transaction is deleted."
    : /missing/i.test(label) ? "Marks the selected tools Missing and keeps their custody record open."
    : /reset demo/i.test(label) ? "Replaces the fictional demo records with the starting scenario."
    : /delete/i.test(label) ? "Permanently removes a never-used tool record."
    : /camera|use code/i.test(label) ? "Finds a student or tool. Review the match before confirming a transaction."
    : /print/i.test(label) ? "Opens your device's print dialog."
    : /apply|filter/i.test(label) ? "Shows records matching the filters you chose."
    : /log out/i.test(label) ? "Ends your session and returns to sign in."
    : /approve|activate/i.test(label) ? "Sets the account to Active so the student can borrow."
    : /disable/i.test(label) ? "Suspends account access while keeping its history."
    : "Runs this action using the details you entered. Wait for a success message before continuing.";
  return { element, label: label.slice(0, 100), description, result };
}

function visibleControls() {
  return [...document.querySelectorAll<HTMLElement>(selector)].filter((element) => !element.closest("[data-guide-ui]") && element.getClientRects().length > 0);
}

export function ApplicationGuide() {
  const pathname = usePathname();
  return <PageGuide key={pathname} pathname={pathname} />;
}

function PageGuide({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"overview" | "inspect" | "tour">("overview");
  const [selected, setSelected] = useState<Control | null>(null);
  const [steps, setSteps] = useState<Control[]>([]);
  const [index, setIndex] = useState(0);
  const [welcome, setWelcome] = useState(false);
  const [dockTop, setDockTop] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const spotlight = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setWelcome(localStorage.getItem("labtrack-guide-seen-v1") !== "yes"); } catch { /* Help works without browser storage. */ }
    });
    function annotate() {
      visibleControls().forEach((element) => {
        if (!element.hasAttribute("title")) element.title = controlInfo(element).description;
      });
    }
    annotate();
    const observer = new MutationObserver(annotate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!selected || !open) return;
    selected.element.classList.add("guide-target");
    selected.element.scrollIntoView({ block: "center", behavior: "instant" });
    function positionSpotlight() {
      if (!spotlight.current || !selected) return;
      const rect = selected.element.getBoundingClientRect();
      Object.assign(spotlight.current.style, {
        left: `${rect.left - 6}px`, top: `${rect.top - 6}px`,
        width: `${rect.width + 12}px`, height: `${rect.height + 12}px`,
        visibility: selected.element.isConnected && rect.width > 0 ? "visible" : "hidden",
      });
    }
    const frame = requestAnimationFrame(() => {
      positionSpotlight();
      if (mode === "tour") setDockTop(selected.element.getBoundingClientRect().top > window.innerHeight / 2);
    });
    window.addEventListener("scroll", positionSpotlight, true);
    window.addEventListener("resize", positionSpotlight);
    const observer = new ResizeObserver(positionSpotlight);
    observer.observe(selected.element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", positionSpotlight, true);
      window.removeEventListener("resize", positionSpotlight);
      selected.element.classList.remove("guide-target");
    };
  }, [selected, open, mode]);

  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); launcher.current?.focus(); }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  useEffect(() => {
    if (!open || mode === "overview") return;
    function explain(event: Event) {
      if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
      const source = event.target instanceof Element ? event.target : null;
      const target = source?.closest<HTMLElement>(selector) ?? source?.closest("label")?.querySelector<HTMLElement>("input,select,textarea");
      if (!target || target.closest("[data-guide-ui]")) return;
      event.preventDefault();
      event.stopPropagation();
      if (mode === "inspect") setSelected(controlInfo(target));
      panel.current?.focus({ preventScroll: true });
    }
    document.addEventListener("click", explain, true);
    document.addEventListener("keydown", explain, true);
    return () => { document.removeEventListener("click", explain, true); document.removeEventListener("keydown", explain, true); };
  }, [open, mode]);

  function dismiss() {
    setOpen(false); setWelcome(false);
    try { localStorage.setItem("labtrack-guide-seen-v1", "yes"); } catch { /* Optional preference. */ }
    launcher.current?.focus();
  }
  function show() { setOpen(true); setWelcome(false); setMode("overview"); setSelected(null); setDockTop(false); }
  function startTour() {
    const controls = visibleControls().map(controlInfo);
    setSteps(controls); setIndex(0); setSelected(controls[0] ?? null); setMode("tour");
    panel.current?.focus();
  }
  function move(offset: number) {
    const next = index + offset;
    setIndex(next); setSelected(steps[next]);
  }

  return <div data-guide-ui className={`guide-root${open && dockTop ? " guide-dock-top" : ""}${open && mode === "tour" ? " guide-tour" : ""}`}>
    {open && mode === "tour" && selected && <div ref={spotlight} className="guide-spotlight" aria-hidden="true" />}
    {!open && welcome && <div className="guide-welcome"><span>Need assistance? Open the user guide.</span><button type="button" onClick={dismiss} aria-label="Dismiss guide invitation" title="Hide this invitation. You can reopen Help & user guide anytime."><X aria-hidden="true" /></button></div>}
    {!open && <button ref={launcher} type="button" className="guide-launcher" onClick={show} aria-label="Help and page guide" title="Open the user guide and control instructions."><CircleHelp aria-hidden="true" /><span>Help & user guide</span></button>}
    {open && <section className="guide-panel" ref={panel} tabIndex={-1} role="region" aria-label="Page guide">
      <header><CircleHelp aria-hidden="true" /><h2>{mode === "overview" ? "Your page guide" : mode === "inspect" ? "Explain a control" : "Page walkthrough"}</h2><button type="button" onClick={dismiss} aria-label="Close guide" title="Close guide"><X aria-hidden="true" /></button></header>
      <div className="guide-content" aria-live="polite">
        {mode === "overview" ? <><p>{describePage(pathname)}</p><ol className="guide-mission-steps">{pageMission(pathname).map((step) => <li key={step}>{step}</li>)}</ol><div className="guide-options"><button type="button" className="button button-primary" onClick={startTour} title="Walk through every visible button and field, one step at a time."><Play aria-hidden="true" />Start page tour</button><button type="button" className="button button-secondary" onClick={() => { setMode("inspect"); setSelected(null); setDockTop(true); }} title="Tap any control to read its instructions without activating it."><MousePointer2 aria-hidden="true" />Explain a control</button><Link href="/guide" className="button button-secondary">Complete user guide</Link></div><p className="guide-note">Guide mode: controls are explained without submitting forms or changing records.</p></> : <>
          {mode === "tour" && steps.length > 0 && <progress className="guide-progress" aria-label="Page tour progress" value={index + 1} max={steps.length} />}
          {selected ? <><h3>{selected.label}</h3><p><strong>What it does</strong><br />{selected.result}</p><p><strong>How to use it</strong><br />{selected.description}</p>{(selected.element as HTMLButtonElement).disabled && <p className="guide-note">This button is currently unavailable. Finish the earlier fields or scans, or wait for the current request to finish.</p>}</> : <p>{mode === "inspect" ? "Tap a button, link or field on this page to read its instructions." : "No controls are visible yet. Open a section, then restart the tour."}</p>}
          <p className="guide-note">While this guide is open, selecting a control explains it. Close the guide to perform the action.</p>
        </>}
      </div>
      <footer>{mode === "tour" && steps.length > 0 ? <><button type="button" onClick={() => move(-1)} disabled={index === 0} title="Previous step" aria-label="Previous step"><ArrowLeft aria-hidden="true" /></button><span>Step {index + 1} of {steps.length}</span>{index < steps.length - 1 ? <button type="button" onClick={() => move(1)} title="Next step" aria-label="Next step"><ArrowRight aria-hidden="true" /></button> : <button type="button" onClick={dismiss}>Finish</button>}</> : <button type="button" onClick={show} disabled={mode === "overview"}>Guide home</button>}<button type="button" onClick={() => setDockTop((current) => !current)} title="Move guide to the other edge of the screen">Move guide</button><button type="button" onClick={dismiss}>{mode === "overview" ? "Skip guide" : "Close guide"}</button></footer>
    </section>}
  </div>;
}
