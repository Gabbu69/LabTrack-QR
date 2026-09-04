export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", "-");
  return <span className={`status-badge status-${normalized}`}><span aria-hidden="true" />{value.replaceAll("_", " ")}</span>;
}
