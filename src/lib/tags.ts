export const TAG_KINDS = ["school", "faculty", "company", "job", "expertise", "help", "location"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const isTagKind = (v: string): v is TagKind => (TAG_KINDS as readonly string[]).includes(v);

/** Lowercase ASCII slug; strips Vietnamese diacritics too. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Accent-insensitive lowercase text, matching members.search_text. */
export function fold(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().trim();
}

export type TagRef = { name: string; slug: string };
