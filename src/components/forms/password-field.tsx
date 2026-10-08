"use client";

import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = Omit<ComponentProps<"input">, "type" | "children" | "className"> & {
  label: string;
  hint?: string;
  className?: string;
};

export function PasswordField({ label, hint, className, id, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const action = `${visible ? "Hide" : "Show"} ${label.toLowerCase()}`;

  return <div className={`password-field${className ? ` ${className}` : ""}`}>
    <label htmlFor={inputId}>{label}</label>
    <div className="password-input-wrap">
      <input {...props} id={inputId} type={visible ? "text" : "password"} aria-describedby={hint ? `${inputId}-hint` : undefined} />
      <button type="button" className="password-toggle" aria-label={action} title={action} aria-controls={inputId} onClick={() => setVisible(value => !value)} disabled={props.disabled}>
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
    {hint && <small id={`${inputId}-hint`}>{hint}</small>}
  </div>;
}
