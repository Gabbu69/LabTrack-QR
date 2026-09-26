import type { Metadata } from "next";
import { MissionGuide } from "@/components/help/mission-guide";

export const metadata: Metadata = { title: "How to play" };
export default function GuidePage() { return <MissionGuide />; }
