import { Link } from "@/i18n/navigation";
import type { TagKind } from "@/lib/tags";

const COLORS: Record<TagKind, string> = {
  school: "border-indigo-200 bg-indigo-50 text-indigo-700",
  faculty: "border-violet-200 bg-violet-50 text-violet-700",
  company: "border-sky-200 bg-sky-50 text-sky-700",
  job: "border-cyan-200 bg-cyan-50 text-cyan-700",
  expertise: "border-emerald-200 bg-emerald-50 text-emerald-700",
  help: "border-amber-200 bg-amber-50 text-amber-800",
  location: "border-rose-200 bg-rose-50 text-rose-700",
};

/** Every tag is a hyperlink to its search page. */
export default function TagLink({ kind, tag, count }: { kind: TagKind; tag: { name: string; slug: string }; count?: number }) {
  return (
    <Link href={`/${kind}/${tag.slug}`} className={`chip ${COLORS[kind]}`}>
      {tag.name}
      {count !== undefined && <span className="ml-1.5 opacity-60">{count}</span>}
    </Link>
  );
}
