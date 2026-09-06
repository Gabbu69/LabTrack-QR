"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleHelp, MousePointer2, Play, X } from "lucide-react";
import { describeControl, describePage } from "@/lib/control-help";

const selector = "button, a[href], summary, input:not([type=hidden]), select, textarea";
type Control = { element: HTMLElement; label: string; description: string };

function controlInfo(element: HTMLElement): Control {
  const field = element as HTMLInputElement;
  const label = (element.getAttribute("aria-label") || field.labels?.[0]?.textContent || element.textContent || element.getAttribute("placeholder") || "Control").replace(/\s+/g, " ").trim();
  const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName);
  const description = element.dataset.help || (isField
    ? `${element.tagName === "SELECT" ? "Choose" : "Enter"} ${label.toLowerCase()}.${field.required ? " This field is required." : ""}${field.type === "password" ? " Keep this value private." : ""}`
    : describeControl(label, element.getAttribute("href")));
  return { element, label: label.slice(0, 100), description };
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
    return () => selected.element.classList.remove("guide-target");
  }, [selected, open]);

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
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
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
  function show() { setOpen(true); setWelcome(false); setMode("overview"); setSelected(null); }
  function startTour() {
    const seen = new Set<string>();
    const controls = visibleControls().filter((element) => !element.closest("nav,.station-rail") && /^(BUTTON|A|SUMMARY)$/.test(element.tagName)).map(controlInfo).filter((control) => {
      if (seen.has(control.description)) return false;
      seen.add(control.description); return true;
    }).slice(0, 7);
    setSteps(controls); setIndex(0); setSelected(controls[0] ?? null); setMode("tour");
    panel.current?.focus();
  }
  function move(offset: number) {
    const next = index + offset;
    setIndex(next); setSelected(steps[next]);
  }

  return <div data-guide-ui className={`guide-root${open && dockTop ? " guide-dock-top" : ""}`}>
    {!open && welcome && <div className="guide-welcome"><span>New here? Follow the page guide.</span><button type="button" onClick={dismiss} aria-label="Dismiss guide invitation" title="Dismiss guide invitation"><X aria-hidden="true" /></button></div>}
    {!open && <button ref={launcher} type="button" className="guide-launcher" onClick={show} aria-label="Help and page guide" title="Help and page guide"><CircleHelp aria-hidden="true" /><span>Help & guide</span></button>}
    {open && <section className="guide-panel" ref={panel} tabIndex={-1} role="region" aria-label="Page guide">
      <header><CircleHelp aria-hidden="true" /><h2>{mode === "overview" ? "Your page guide" : mode === "inspect" ? "Explain a control" : "Page walkthrough"}</h2><button type="button" onClick={dismiss} aria-label="Close guide" title="Close guide"><X aria-hidden="true" /></button></header>
      <div className="guide-content" aria-live="polite">
        {mode === "overview" ? <><p>{describePage(pathname)}</p><div className="guide-options"><button type="button" className="button button-primary" onClick={startTour}><Play aria-hidden="true" />Start page tour</button><button type="button" className="button button-secondary" onClick={() => { setMode("inspect"); setSelected(null); setDockTop(true); }}><MousePointer2 aria-hidden="true" />Explain a control</button></div><p className="guide-note">You can skip or reopen this guide anytime.</p></> : <>
          {selected ? <><h3>{selected.label}</h3><p>{selected.description}</p>{(selected.element as HTMLButtonElement).disabled && <p className="guide-note">This control is currently unavailable. Complete the preceding selection or wait for the current action to finish.</p>}</> : <p>{mode === "inspect" ? "Select a button, link or field on this page to read its instructions." : "There are no actions to walk through yet. Open a section or try Explain a control."}</p>}
          <p className="guide-note">While this guide is open, selecting a control explains it. Close the guide to perform the action.</p>
        </>}
      </div>
      <footer>{mode === "tour" && steps.length > 0 ? <><button type="button" onClick={() => move(-1)} disabled={index === 0} title="Previous step" aria-label="Previous step"><ArrowLeft aria-hidden="true" /></button><span>Step {index + 1} of {steps.length}</span>{index < steps.length - 1 ? <button type="button" onClick={() => move(1)} title="Next step" aria-label="Next step"><ArrowRight aria-hidden="true" /></button> : <button type="button" onClick={dismiss}>Finish</button>}</> : <button type="button" onClick={show} disabled={mode === "overview"}>Guide home</button>}<button type="button" onClick={() => setDockTop((current) => !current)} title="Move guide to the other edge of the screen">Move guide</button><button type="button" onClick={dismiss}>{mode === "overview" ? "Skip guide" : "Close guide"}</button></footer>
    </section>}
  </div>;
}
