export default function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span style={style} className="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700" aria-hidden>
      {initials}
    </span>
  );
}
