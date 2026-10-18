import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Header from "@/components/Header";
import { siteUrl } from "@/lib/site";
import "../globals.css";

export const viewport: Viewport = { themeColor: "#2a55d6", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: { siteName: t("siteName"), type: "website", locale: locale === "vi" ? "vi_VN" : "en_US", images: ["/og.png"] },
    twitter: { card: "summary_large_image" },
    appleWebApp: { capable: true, title: t("siteName") },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "vi" | "en")) notFound();
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "nav" });
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header locale={locale} />
          <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-center text-xs text-slate-500">{t("footer")}</footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
