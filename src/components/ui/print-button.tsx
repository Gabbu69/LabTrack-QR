"use client";

import { Printer } from "lucide-react";

export function PrintButton() { return <button className="button button-primary print-trigger" type="button" onClick={() => window.print()}><Printer aria-hidden="true" />Print A4 sheet</button>; }
