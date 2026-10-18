import { Link } from "@/i18n/navigation";
import Avatar from "@/components/Avatar";
import TagLink from "@/components/TagLink";
import type { MemberCardData } from "@/lib/data";

export default function MemberCard({ m }: { m: MemberCardData }) {
  return (
    <article className="card flex gap-3">
      <Avatar name={m.full_name} url={m.avatar_url} size={56} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold">
          <Link href={`/m/${m.slug}`} className="text-slate-900 no-underline hover:text-brand-600">
            {m.full_name}
          </Link>
        </h3>
        {m.headline && <p className="line-clamp-2 text-sm text-slate-600">{m.headline}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {m.position && (
            <>
              <TagLink kind="job" tag={m.position.job} />
              <TagLink kind="company" tag={m.position.company} />
            </>
          )}
          {m.school && <TagLink kind="school" tag={m.school} />}
          {m.location && <TagLink kind="location" tag={m.location} />}
        </div>
      </div>
    </article>
  );
}
