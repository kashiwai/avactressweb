import Link from "next/link";
import { Search } from "lucide-react";
import { createActress } from "@/lib/actions/admin";
import { dmmConfigured, searchDmmActress } from "@/lib/dmm";
import { ActressFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Avatar, Button, Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewActressPage({ searchParams }: PageProps<"/admin/actresses/new">) {
  const sp = await searchParams;
  const kw = typeof sp.dmm === "string" ? sp.dmm.trim().slice(0, 50) : "";
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const result = kw ? await searchDmmActress(kw) : null;
  const configured = dmmConfigured();

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="女優を登録" />
      <Card className="p-5">
        <h2 className="mb-1 font-bold">DMMから探して入力する</h2>
        <p className="mb-3 text-xs text-muted">{configured ? "名前で検索して選ぶと、DMM女優ID・よみがな・画像が自動で入ります。" : "DMMのAPIキーが未設定のため検索できません。下の欄に直接入力してください（キー設定後に検索が使えます）。"}</p>
        <form method="get" className="flex gap-2">
          <input name="dmm" defaultValue={kw} placeholder="女優名" aria-label="DMMで検索する女優名" disabled={!configured} className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm disabled:opacity-50" />
          <Button type="submit" variant="secondary" disabled={!configured}><Search className="size-4" aria-hidden />検索</Button>
        </form>
        {result && !result.ok && <p className="mt-3 text-sm text-red-700">{result.error}</p>}
        {result?.ok && (
          result.items.length === 0 ? <p className="mt-3 text-sm text-muted">見つかりませんでした。</p> : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {result.items.map((a) => (
                <Link prefetch={false}
                  key={a.id}
                  href={`/admin/actresses/new?${new URLSearchParams({ name: a.name, kana: a.ruby, dmmActressId: a.id, imageUrl: a.imageUrl })}`}
                  className="flex items-center gap-2 rounded-lg border border-line p-2 text-sm hover:border-rose-500/40"
                >
                  <Avatar name={a.name} src={a.imageUrl} size={40} />
                  <span>{a.name}<span className="block text-xs text-muted">{a.ruby}／ID {a.id}</span></span>
                </Link>
              ))}
            </div>
          )
        )}
      </Card>
      <Card className="p-5">
        <ActionForm action={createActress}>
          <ActressFields prefill={{ name: pick("name"), kana: pick("kana"), dmmActressId: pick("dmmActressId"), imageUrl: pick("imageUrl") }} />
          <div className="flex gap-2">
            <SubmitButton>登録する</SubmitButton>
            <LinkButton href="/admin/actresses" variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
