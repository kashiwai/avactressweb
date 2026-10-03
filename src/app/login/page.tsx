import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";
import { Toast } from "@/components/client";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "ログイン", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const u = await getCurrentUser();
  if (u && sp.error !== "forbidden") redirect(u.role === "admin" ? "/admin" : "/shop");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center font-bold">{SITE_NAME}</Link>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-lg font-bold">店舗・運営者ログイン</h1>
          {sp.error === "forbidden" && (
            <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-50 p-2 text-sm text-amber-800">この画面を開く権限がありません。権限のあるアカウントでログインし直してください。</p>
          )}
          <LoginForm />
        </div>
      </div>
      <Suspense>
        <Toast />
      </Suspense>
    </main>
  );
}
