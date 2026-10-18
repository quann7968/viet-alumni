"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const go = (next: "vi" | "en") => router.replace(pathname + window.location.search, { locale: next });
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold" role="group" aria-label="Language">
      {(["vi", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => go(l)}
          aria-pressed={locale === l}
          className={`min-h-[36px] px-2.5 ${locale === l ? "bg-brand-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
