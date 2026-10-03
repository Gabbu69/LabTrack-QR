"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print A4 sheet" }: { label?: string }) { return <button className="button button-primary print-trigger" type="button" onClick={() => window.print()}><Printer aria-hidden="true" />{label}</button>; }
