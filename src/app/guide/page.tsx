import type { Metadata } from "next";
import { MissionGuide } from "@/components/help/mission-guide";

export const metadata: Metadata = { title: "Help & user guide" };
export default function GuidePage() { return <><MissionGuide /><section className="page-wrap"><div className="content-card"><h2>Thesis evaluation worksheet</h2><p>Use the blank task and feedback sheets during a supervised evaluation.</p><a className="button button-secondary" href="/thesis-evaluation.html">Open printable worksheet</a></div></section></>; }
