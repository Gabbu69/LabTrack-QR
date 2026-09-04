export function LabTrackMark({ className = "" }: { className?: string }) {
  return (
    <svg className={`labtrack-mark ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
      <path className="mark-corner" d="M20 7H8v13M44 7h12v13M20 57H8V44M44 57h12V44" />
      <path className="mark-aircraft" d="m32 9 5 17 14 7-2 5-13-3-1 15-3 5-3-5-1-15-13 3-2-5 14-7z" />
      <path className="mark-centerline" d="M32 16v29" />
    </svg>
  );
}
