// Verifies: en/vi have identical keys, and every literal t("ns.key") used in source exists.
import fs from "node:fs";
import path from "node:path";

const load = (l) => JSON.parse(fs.readFileSync(`messages/${l}.json`, "utf8"));
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const en = new Set(flat(load("en"))), vi = new Set(flat(load("vi")));
let bad = 0;
for (const k of en) if (!vi.has(k)) (console.error("missing in vi:", k), bad++);
for (const k of vi) if (!en.has(k)) (console.error("missing in en:", k), bad++);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
for (const f of walk("src")) {
  const src = fs.readFileSync(f, "utf8");
  const vars = new Map();
  for (const m of src.matchAll(/(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(?:\{[^}]*namespace:\s*)?"(\w+)"/g)) vars.set(m[1], [...(vars.get(m[1]) ?? []), m[2]]);
  for (const [v, nss] of vars)
    for (const m of src.matchAll(new RegExp(`\\b${v}\\(\\s*"([\\w.]+)"`, "g")))
      if (!nss.some((ns) => en.has(`${ns}.${m[1]}`))) (console.error(`${f}: unknown key ${nss}.${m[1]}`), bad++);
}
console.log(bad ? `${bad} problem(s)` : "i18n OK");
process.exit(bad ? 1 : 0);
