# Alumni Connect

A simple, bilingual (Vietnamese / English), SEO-friendly alumni network.

- **Public profiles** with full name, bio (vi + en), career, education, expertise and "I can help with".
- **Everything is a link.** Every school, faculty, company, job title, expertise, help type and city links to a search page of everyone who shares it (`/school/hust`, `/expertise/data-science`, …). Filters combine in the URL: `/directory?school=hust&expertise=ai`.
- **Verified members only** can see contact details and send connect requests. A request must be **accepted** before messaging opens.
- **Verification** by admin approval, or instantly through a member's **invite link**.
- Mobile-first, installable as a PWA (Add to Home Screen). No native app.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · next-intl · Supabase (Postgres, Auth, Storage, RLS) · Resend (optional email).

---

## 1. Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) account
- (Optional) A [Resend](https://resend.com) account for email notifications
- (Production) A [Vercel](https://vercel.com) account

## 2. Install

```bash
git clone <this repo> && cd viet-alumni
npm install
cp .env.example .env.local
```

## 3. Create the Supabase project

1. Supabase dashboard → **New project**. Save the database password.
2. **Project Settings → API**: copy the *Project URL*, the *anon public* key and the *service_role* key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # server only, never expose
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
3. **SQL Editor → New query**: paste the whole of `supabase/migrations/001_schema.sql` and **Run**.
   This creates the tables, row-level-security policies, search views, RPC functions, the `avatars` storage bucket and a few starter tags.
   (With the Supabase CLI instead: `supabase link --project-ref <ref> && supabase db push`.)

## 4. Configure sign-in (magic links)

**Authentication → URL Configuration**

- *Site URL*: `http://localhost:3000` (use your real domain in production)
- *Redirect URLs*: add `http://localhost:3000/**` (and `https://YOUR-DOMAIN/**` in production). The wildcard is needed because the link carries `?locale=…&next=…` parameters.

**Authentication → Providers → Email**: keep *Enable email provider* on. Turn *Confirm email* on (default).

**Recommended (makes links work even if opened in another browser/app, e.g. an email app on your phone):**
Authentication → Email Templates → **Magic Link**, set the link to:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Log in</a>
```

Simpler variant (also works): keep the default template; the link then needs to be opened in the same browser that requested it.

> The built-in Supabase mail sender is rate-limited (a few emails per hour). Before launch, set up
> **Authentication → SMTP Settings** with Resend (host `smtp.resend.com`, port 465, user `resend`, password = your API key).

## 5. Run locally

```bash
npm run dev
# open http://localhost:3000   (redirects to /vi or /en by browser language)
```

## 6. Create your first admin

1. Open the site, **Log in** with your email and click the magic link.
2. In Supabase **SQL Editor** run (use your email):
   ```sql
   update members set role = 'admin', status = 'verified'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Reload the site. An **Admin** link appears in the header.

## 7. Day-to-day flow

| Who | What |
|---|---|
| Member | Log in → *My profile* (fill in, add tags) → *Get verified* (school, year, proof) |
| Admin | *Admin* → approve/reject pending verifications, resolve reports, rename/delete tags |
| Verified member | See contacts, send connect requests, chat after acceptance, create invite links (*Invite*) |
| Invited person | Opens `/join/<code>` → signs in → verified automatically |

Seed the community fast: as admin, create invite links and send them to the first alumni (each link allows 5 uses, valid 30 days; up to 5 active links per member).

## 8. Optional: email notifications

Set in `.env.local` (and in Vercel):

```
RESEND_API_KEY=re_...
RESEND_FROM="Alumni Connect <noreply@yourdomain.com>"
```

Emails are sent for connect requests, acceptances and verification results. Without a key they're skipped silently.

## 9. Deploy to Vercel

1. Push the repo to GitHub → Vercel **Add New → Project** → import it (framework: Next.js, auto-detected).
2. Add all variables from `.env.local`. Set `NEXT_PUBLIC_SITE_URL` to your production URL (e.g. `https://alumni.example.com`).
3. Deploy, then in Supabase update **Site URL** and **Redirect URLs** to the production domain.
4. Submit `https://YOUR-DOMAIN/sitemap.xml` in Google Search Console.
5. Recommended: put the domain behind Cloudflare for bot protection, and add Sentry if you want error monitoring.

## 10. How the key requirements are implemented

- **Public + SEO:** profile and tag pages are server-rendered with metadata, canonical + `hreflang` (`/vi`, `/en`), JSON-LD (`Person`, `CollectionPage`), `sitemap.xml` and `robots.txt`.
  Tag pages with fewer than 3 members and any filtered/combined `/directory?…` URL are `noindex`. Members who turn off *Show my profile publicly* are `noindex`, removed from the sitemap and the directory.
- **Contact gating is enforced in the database**, not just the UI: `member_contacts` rows are readable only by the owner, admins and *verified* members (Postgres RLS). Anonymous visitors never receive them.
- **Spam control:** connect requests need verification, max 10 per 24 h, one per pair, recipient must accept; report button + admin queue.
- **Tags are English-only** with one row per `(kind, slug)`, so "Data Science" and "data  science" resolve to the same tag; UI text is translated (`messages/vi.json`, `messages/en.json`). Search is accent-insensitive ("Nguyen" finds "Nguyễn").
- **Bilingual bio:** `bio_vi` and `bio_en`; visitors see their language, falling back to the other.

## 11. Scripts

```bash
npm run dev          # development
npm run build        # production build (type-checks)
npm start            # run the production build
npm run lint         # tsc --noEmit
npm run check:i18n   # en/vi key parity + unknown translation keys
```

## 12. Project layout

```
supabase/migrations/001_schema.sql   database, RLS, RPC functions, seed tags
messages/{vi,en}.json                UI translations
src/middleware.ts                    locale routing + session refresh
src/app/[locale]/…                   pages (home, directory, [kind]/[slug], m/[slug], verify, profile/edit,
                                     connections, invite, join, admin, login)
src/app/actions.ts                   all server actions (auth, profile, verification, connect, admin)
src/app/auth/callback/route.ts       magic-link landing + invite redemption
src/lib/data.ts                      directory search + facets
src/components/…                     TagInput, ProfileForm, MemberCard, …
```

## 13. Troubleshooting

- **"Link is invalid or expired"** → open the magic link in the same browser you requested it from, or apply the `token_hash` email template from step 4.
- **Profile edits fail to save / empty directory** → confirm the SQL migration ran fully (re-run on a fresh project; it is not idempotent).
- **A new member doesn't appear in the directory** → only *verified* + *public* profiles are listed; approve them in **Admin**.
- **Emails not arriving** → check spam, then configure custom SMTP (step 4).
- **Upgrading TypeScript** → keep `typescript@5.x`; Next 15 does not load `next.config.ts` with TypeScript 7.

## Not included (ideas for later)

Per-profile dynamic Open Graph images, real-time chat (messages poll every 8 s), LinkedIn import, school-admin analytics, multi-school tenancy (add a `school_id` to members/tags when needed).
