// Brief 3 #6 — Public booking page at /book/[slug].
//
// Looks up the tenant by `booking_slug` (set in /dashboard/settings/
// online-booking) and renders a public-safe brand card with contact
// buttons. The full booking form (services + slot picker + prepay +
// anti-spam) is its own story (STORY-085 follow-up); this MVP makes
// the URL real, surfaces the tenant's brand, and gives every visitor
// a clear way to reach them — phone, WhatsApp, Telegram, Instagram.
//
// Access model: public. The service-role Supabase client is used to
// bypass RLS for the slug lookup; only public-by-design fields are
// projected (brand_name, logo_url, contacts). No PII outside the
// contact channels the tenant put in their settings.

import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, MessageCircle, Send, Camera } from "@babun/shared/icons";
import { getSupabaseService } from "@/lib/supabase/service";
import {
  whatsappUrl,
  telegramUrl,
  telUrl,
  instagramUrl,
} from "@babun/shared/common/utils/messenger-links";

export const metadata = {
  title: "Онлайн запись · Babun",
};

interface TenantBrand {
  brand_name: string | null;
  logo_url: string | null;
  business_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  contact_telegram: string | null;
  contact_instagram: string | null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BookPage(props: PageProps) {
  const { slug } = await props.params;
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/.test(normalized)) notFound();

  const sb = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("tenants")
    .select(
      "brand_name, logo_url, business_address, contact_phone, contact_email, contact_whatsapp, contact_telegram, contact_instagram",
    )
    .eq("booking_slug", normalized)
    .maybeSingle();

  if (error || !data) notFound();
  const tenant = data as TenantBrand;

  const displayName = tenant.brand_name?.trim() || "Сервис";
  const initials = displayName
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const whatsapp = whatsappUrl(tenant.contact_whatsapp);
  const telegram = telegramUrl(tenant.contact_telegram, tenant.contact_phone);
  const phone = telUrl(tenant.contact_phone);
  const instagram = instagramUrl(tenant.contact_instagram);
  const email = tenant.contact_email?.trim()
    ? `mailto:${tenant.contact_email.trim()}`
    : null;

  const anyContact = phone || whatsapp || telegram || instagram || email;

  return (
    <main
      className="min-h-screen bg-[var(--surface-grouped)]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="max-w-md mx-auto px-4 pt-8 space-y-5">
        <header className="text-center">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={displayName}
              className="w-20 h-20 mx-auto rounded-[20px] object-cover shadow-md"
            />
          ) : (
            <div className="w-20 h-20 mx-auto rounded-[20px] bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center text-[28px] font-bold shadow-md">
              {initials || "?"}
            </div>
          )}
          <h1 className="mt-4 text-[24px] font-bold tracking-tight text-[var(--label)]">
            {displayName}
          </h1>
          {tenant.business_address && (
            <div className="mt-1 text-[13px] text-[var(--label-secondary)] leading-snug">
              {tenant.business_address}
            </div>
          )}
        </header>

        {anyContact ? (
          <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
            {phone && (
              <ContactRow
                href={phone}
                label="Позвонить"
                value={tenant.contact_phone!}
                icon={<Phone size={18} strokeWidth={2} />}
                tone="bg-[var(--accent)]"
              />
            )}
            {whatsapp && (
              <ContactRow
                href={whatsapp}
                label="WhatsApp"
                value={tenant.contact_whatsapp!}
                icon={<MessageCircle size={18} strokeWidth={2} />}
                tone="bg-[#25D366]"
                external
              />
            )}
            {telegram && (
              <ContactRow
                href={telegram}
                label="Telegram"
                value={tenant.contact_telegram!}
                icon={<Send size={18} strokeWidth={2} />}
                tone="bg-[#2AABEE]"
                external
              />
            )}
            {instagram && (
              <ContactRow
                href={instagram}
                label="Instagram"
                value={tenant.contact_instagram!}
                icon={<Camera size={18} strokeWidth={2} />}
                tone="bg-gradient-to-br from-[#FFD600] via-[#FF7A00] to-[#D72E7D]"
                external
              />
            )}
            {email && (
              <ContactRow
                href={email}
                label="Email"
                value={tenant.contact_email!}
                icon={<Mail size={18} strokeWidth={2} />}
                tone="bg-[var(--label-secondary)]"
              />
            )}
          </section>
        ) : (
          <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 text-center">
            <div className="text-[14px] text-[var(--label-secondary)] leading-snug">
              Контакты пока не указаны. Загляните позже.
            </div>
          </section>
        )}

        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] p-4 text-center">
          <div className="text-[13px] font-semibold text-[var(--label)]">
            Онлайн-форма записи скоро
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-secondary)] leading-snug">
            Пока свяжитесь напрямую любым способом выше — мы запишем
            вас вручную и пришлём подтверждение.
          </div>
        </div>

        <footer className="text-center text-[11px] text-[var(--label-tertiary)] pt-2">
          <Link href="/" className="hover:underline">
            babun.app
          </Link>
        </footer>
      </div>
    </main>
  );
}

function ContactRow({
  href,
  label,
  value,
  icon,
  tone,
  external = false,
}: {
  href: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 px-4 py-3 min-h-[56px] active:bg-[var(--fill-quaternary)] transition"
    >
      <span
        className={`w-10 h-10 rounded-[12px] text-white flex items-center justify-center shrink-0 ${tone}`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-[var(--label)]">
          {label}
        </span>
        <span className="block text-[12px] text-[var(--label-secondary)] truncate">
          {value}
        </span>
      </span>
    </a>
  );
}

