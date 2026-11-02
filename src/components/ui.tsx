// 共通UI部品（サーバー・クライアントどちらからも使える純粋な表示部品）
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { AvatarFallback, AvatarImage } from "./avatar-image";
import { avatarFallbackUrl, avatarImageUrl } from "@/lib/images";

export function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const btnVariants = {
  primary: "bg-accent text-white hover:bg-rose-700",
  secondary: "bg-surface-2 text-foreground border border-line hover:bg-gray-200",
  ghost: "text-muted hover:text-foreground hover:bg-surface-2",
  danger: "bg-red-50 text-red-700 border border-red-500/30 hover:bg-red-100",
} as const;
export type BtnVariant = keyof typeof btnVariants;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button className={cn(btnBase, btnVariants[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link prefetch={false} className={cn(btnBase, btnVariants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-line bg-surface", className)} {...props} />;
}

const badgeTones = {
  accent: "bg-accent-soft text-rose-700 border-rose-500/30",
  ok: "bg-green-50 text-green-700 border-green-500/30",
  warn: "bg-amber-50 text-amber-700 border-amber-500/30",
  muted: "bg-surface-2 text-muted border-line",
  info: "bg-sky-50 text-sky-700 border-sky-500/30",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "muted", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint, href }: { label: string; value: ReactNode; icon: LucideIcon; hint?: string; href?: string }) {
  const body = (
    <Card className={cn("p-4", href && "transition-colors hover:border-rose-500/40")}>
      <div className="flex items-center justify-between text-muted">
        <span className="text-sm">{label}</span>
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <Inbox className="size-8 text-muted" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none";

type FieldBase = { label: string; name: string; hint?: string; required?: boolean };

export function Field({ label, name, hint, required, ...props }: FieldBase & Omit<ComponentProps<"input">, "name">) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      <input name={name} required={required} className={inputCls} {...props} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function TextAreaField({ label, name, hint, required, ...props }: FieldBase & Omit<ComponentProps<"textarea">, "name">) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      <textarea name={name} required={required} rows={4} className={inputCls} {...props} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  name,
  hint,
  required,
  options,
  ...props
}: FieldBase & Omit<ComponentProps<"select">, "name"> & { options: Array<{ value: string | number; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      <select name={name} required={required} className={inputCls} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function CheckboxField({ label, name, hint, ...props }: Omit<FieldBase, "required"> & Omit<ComponentProps<"input">, "name" | "type">) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" name={name} className="mt-1 size-4 accent-rose-500" {...props} />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("bg-surface-2 px-3 py-2 text-left text-xs font-semibold text-muted", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-t border-line px-3 py-2 align-middle", className)}>{children}</td>;
}

/** 女優の画像。未設定なら頭文字を出す */
export function Avatar({ name, src, size = 56 }: { name: string; src?: string | null; size?: number }) {
  const url = avatarImageUrl(src);
  const fallback = avatarFallbackUrl(src);
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-rose-100 to-pink-50 align-middle ring-1 ring-black/5"
      style={{ width: size, height: size }}
    >
      {url ? (
        <AvatarImage
          key={url}
          name={name}
          src={url}
          fallbackSrc={fallback}
          size={size}
          position={fallback || /adultinfojpn\.com/.test(url) ? "center" : "top"}
        />
      ) : (
        <AvatarFallback name={name} size={size} />
      )}
    </span>
  );
}
