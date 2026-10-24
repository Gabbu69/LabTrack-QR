"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";

export function ProfilePhotoPicker({ initialUrl }: { initialUrl: string | null }) {
  const [preview, setPreview] = useState(initialUrl);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="profile-photo-picker full">
    <div className="profile-picture-preview">{preview ? <Image src={preview} alt="Profile picture preview" fill sizes="96px" unoptimized /> : <Camera aria-hidden="true" />}</div>
    <div><label htmlFor="profile-picture">Profile picture</label><p>Choose a photo, then Save profile.</p>
      <input ref={input} id="profile-picture" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="profile-picture-help" onChange={event => {
        const file = event.currentTarget.files?.[0]; setError("");
        if (!file) return;
        if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPEG, PNG, or WebP picture up to 2 MB."); event.currentTarget.value = ""; return; }
        setPreview(URL.createObjectURL(file));
      }} />
      <small id="profile-picture-help">JPEG, PNG, or WebP · up to 2 MB</small>
      {preview !== initialUrl && <button type="button" className="text-link" onClick={() => { if (input.current) input.current.value = ""; setPreview(initialUrl); setError(""); }}>Cancel selected picture</button>}
      {error && <p role="alert" className="scanner-error">{error}</p>}
    </div>
  </div>;
}
