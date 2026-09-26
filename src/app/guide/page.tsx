import type { Metadata } from "next";
import { MissionGuide } from "@/components/help/mission-guide";

export const metadata: Metadata = { title: "Help & user guide" };
export default function GuidePage() { return <MissionGuide />; }
