import Link from "next/link";
import { PAGE_SIZE, pageHref, type SearchParams } from "@/lib/query-filters";

export function Pagination({ path, params, page, count }: { path: string; params: SearchParams; page: number; count: number }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const numbers = [...new Set([1, ...Array.from({ length: 5 }, (_, index) => page + index - 2), pages])].filter((value) => value > 0 && value <= pages).sort((a, b) => a - b);
  return <nav className="pagination" aria-label="Results pages"><span>{count} records · Page {page} of {pages}</span><div>
    {page > 1 && <Link className="button button-secondary button-small" href={pageHref(path, params, page - 1)}>Previous</Link>}
    {numbers.map((number, index) => <span key={number}>{index > 0 && number > numbers[index - 1] + 1 && <span aria-hidden="true"> … </span>}<Link className={`button button-small ${number === page ? "button-primary" : "button-secondary"}`} aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} href={pageHref(path, params, number)}>{number}</Link></span>)}
    {page < pages && <Link className="button button-secondary button-small" href={pageHref(path, params, page + 1)}>Next</Link>}
  </div></nav>;
}
