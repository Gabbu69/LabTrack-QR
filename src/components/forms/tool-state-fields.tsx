"use client";

import { useState } from "react";
import type { ToolCondition, ToolStatus } from "@/types/app";

export function ToolStateFields({ condition: initialCondition, status: initialStatus }: { condition: ToolCondition; status: ToolStatus }) {
  const [condition, setCondition] = useState(initialCondition);
  const [status, setStatus] = useState(initialStatus);
  const inCustody = initialStatus === "borrowed" || initialStatus === "missing";
  const statuses: ToolStatus[] = inCustody ? [initialStatus] : condition === "damaged" ? ["unavailable", "archived"] : ["available", "unavailable", "archived"];
  function changeCondition(next: ToolCondition) {
    setCondition(next);
    if (next === "damaged" && status === "available") setStatus("unavailable");
  }
  return <>
    <label className="field"><span>Condition</span><select name="condition" value={condition} onChange={(event) => changeCondition(event.target.value as ToolCondition)}><option value="good">Good</option><option value="fair">Fair</option>{!inCustody && <option value="damaged">Damaged</option>}</select></label>
    <label className="field"><span>Status</span><select name={inCustody ? undefined : "status"} value={status} disabled={inCustody} onChange={(event) => setStatus(event.target.value as ToolStatus)}>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    {inCustody && <input type="hidden" name="status" value={initialStatus} />}
    <p className="full">{inCustody ? "This tool is in borrower custody. Record damage or recover missing tools through Return before changing availability." : "Borrowing and missing custody are recorded through Checkout and Return. Damaged tools stay unavailable or archived until their condition is repaired."}</p>
  </>;
}
