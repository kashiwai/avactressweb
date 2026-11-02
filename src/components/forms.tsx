// 登録・編集で共用する入力欄のまとまり
import type { Actress, DataSource, Enrollment, Shop } from "@/db/schema";
import { PREFECTURES } from "@/lib/prefectures";
import { GENRES } from "@/lib/genres";
import { todayJst } from "@/lib/dates";
import { CheckboxField, Field, SelectField, TextAreaField } from "./ui";

export function ShopFields({ shop }: { shop?: Shop }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {shop && <input type="hidden" name="id" value={shop.id} />}
      <Field label="店舗名" name="name" required maxLength={100} defaultValue={shop?.name} />
      <SelectField
        label="都道府県"
        name="prefCode"
        required
        defaultValue={shop?.prefCode ?? ""}
        options={[{ value: "", label: "選んでください" }, ...PREFECTURES.map((p) => ({ value: p.code, label: p.name }))]}
      />
      <Field label="エリア" name="area" maxLength={50} placeholder="例：新宿・歌舞伎町" defaultValue={shop?.area} />
      <SelectField label="業種" name="genre" required defaultValue={shop?.genre ?? ""} options={[{ value: "", label: "選んでください" }, ...GENRES.map((g) => ({ value: g.name, label: g.name }))]} />
      <Field label="公式サイトURL" name="officialUrl" type="url" maxLength={1000} defaultValue={shop?.officialUrl} />
      <Field label="電話番号" name="phone" maxLength={30} defaultValue={shop?.phone} />
      <Field label="営業時間" name="businessHours" maxLength={100} placeholder="例：10:00〜翌5:00" defaultValue={shop?.businessHours} />
      <div className="sm:col-span-2">
        <TextAreaField label="紹介文" name="description" maxLength={2000} defaultValue={shop?.description} />
      </div>
      <Field
        label="名前非公開のAV女優在籍数"
        name="anonymousAvCount"
        type="number"
        min={0}
        max={999}
        defaultValue={shop?.anonymousAvCount ?? 0}
        hint="お店が「AV女優在籍（名前は非公開）」と公表している人数"
      />
      <Field label="在籍数の根拠URL" name="anonymousAvSourceUrl" type="url" maxLength={1000} defaultValue={shop?.anonymousAvSourceUrl} hint="人数を入れる場合は必須" />
      <div className="sm:col-span-2">
        <CheckboxField label="公開する" name="isPublished" defaultChecked={shop?.isPublished ?? true} hint="外すと公開サイトに表示されません" />
      </div>
    </div>
  );
}

export function ActressFields({ actress, prefill }: { actress?: Actress; prefill?: { name?: string; kana?: string; dmmActressId?: string; imageUrl?: string } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {actress && <input type="hidden" name="id" value={actress.id} />}
      <Field label="名前" name="name" required maxLength={100} defaultValue={actress?.name ?? prefill?.name} />
      <Field label="よみがな" name="kana" maxLength={100} defaultValue={actress?.kana ?? prefill?.kana} />
      <Field label="DMM女優ID" name="dmmActressId" inputMode="numeric" maxLength={20} defaultValue={actress?.dmmActressId ?? prefill?.dmmActressId ?? ""} hint="入れると女優ページにFANZAの作品が表示されます（APIキー設定時）" />
      <Field label="画像URL" name="imageUrl" type="url" maxLength={1000} defaultValue={actress?.imageUrl ?? prefill?.imageUrl} hint="DMMの女優画像など、掲載が許されている画像のみ" />
      <div className="sm:col-span-2">
        <TextAreaField label="プロフィール" name="profile" maxLength={3000} defaultValue={actress?.profile} />
      </div>
      <div className="sm:col-span-2">
        <CheckboxField label="公開する" name="isPublished" defaultChecked={actress?.isPublished ?? true} />
      </div>
    </div>
  );
}

export function EnrollmentFields({
  enrollment,
  actressOptions,
  shopOptions,
  preset,
}: {
  enrollment?: Enrollment;
  actressOptions: Array<{ id: number; name: string }>;
  shopOptions: Array<{ id: number; name: string }>;
  preset?: { actressId?: number; shopId?: number };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {enrollment && <input type="hidden" name="id" value={enrollment.id} />}
      <SelectField
        label="女優"
        name="actressId"
        required
        defaultValue={enrollment?.actressId ?? preset?.actressId ?? ""}
        options={[{ value: "", label: "選んでください" }, ...actressOptions.map((a) => ({ value: a.id, label: a.name }))]}
      />
      <SelectField
        label="店舗"
        name="shopId"
        required
        defaultValue={enrollment?.shopId ?? preset?.shopId ?? ""}
        options={[{ value: "", label: "選んでください" }, ...shopOptions.map((s) => ({ value: s.id, label: s.name }))]}
      />
      <Field label="店での名前（源氏名）" name="shopDisplayName" required maxLength={100} defaultValue={enrollment?.shopDisplayName} hint="取り込み時はこの名前と完全一致したものだけ反映します" />
      <Field label="確認日" name="verifiedAt" type="date" required defaultValue={enrollment?.verifiedAt ?? todayJst()} />
      <div className="sm:col-span-2">
        <Field
          label="在籍の根拠URL"
          name="sourceUrl"
          type="url"
          required
          maxLength={1000}
          defaultValue={enrollment?.sourceUrl}
          hint="お店が「AV女優〇〇在籍」と公表しているページ。公表されていない在籍は登録しないでください"
        />
      </div>
      <div className="sm:col-span-2">
        <TextAreaField label="根拠メモ" name="sourceNote" rows={2} maxLength={500} defaultValue={enrollment?.sourceNote} placeholder="例：公式サイトの在籍一覧に「AV女優」表記あり" />
      </div>
      <SelectField
        label="状態"
        name="status"
        defaultValue={enrollment?.status ?? "active"}
        options={[
          { value: "active", label: "在籍中" },
          { value: "left", label: "退店（公開画面に出さない）" },
        ]}
      />
    </div>
  );
}

export function SourceFields({ source, shopOptions }: { source?: DataSource; shopOptions: Array<{ id: number; name: string }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {source && <input type="hidden" name="id" value={source.id} />}
      <Field label="名称" name="name" required maxLength={100} defaultValue={source?.name} placeholder="例：〇〇店 出勤フィード" />
      <SelectField
        label="形式"
        name="kind"
        defaultValue={source?.kind ?? "json_feed"}
        options={[
          { value: "json_feed", label: "JSONフィード（店舗提供）" },
          { value: "avzoku", label: "avzoku（許可済みまとめサイト）" },
          { value: "avfuzoku", label: "avfuzoku-soap-deli（許可済み・在籍情報のみ）" },
          { value: "adultinfo", label: "adultinfojpn（許可済み・女優ページ）" },
          { value: "fuuav", label: "FuuAV（許可済み・在籍/退店まとめ）" },
          { value: "koukyuderi", label: "コウデリ AV女優在籍風俗店情報" },
          { value: "avfuuzoku", label: "AV女優風俗在籍情報更新.com" },
          { value: "cityheaven", label: "シティヘブン（セクシー女優の本日出勤）" },
        ]}
      />
      <SelectField
        label="対象の店舗（JSONフィードのみ）"
        name="shopId"
        defaultValue={source?.shopId ?? ""}
        options={[{ value: "", label: "選択しない（まとめサイト型）" }, ...shopOptions.map((s) => ({ value: s.id, label: s.name }))]}
      />
      <Field label="巡回ページ数（まとめサイト型）" name="maxPages" type="number" min={1} max={60} defaultValue={source?.maxPages ?? 7} hint="1地域あたり何ページまで見るか（1ページ100人）。FuuAV は全記事が45ページあるため60を指定してください" />
      <div className="sm:col-span-2">
        <Field
          label="取り込み元のURL"
          name="url"
          type="url"
          required
          maxLength={1000}
          defaultValue={source?.url}
          hint="avzoku：https://avzoku.com/schedule/tokyo-deliveryhealth/　avfuzoku：https://www.avfuzoku-soap-deli.com/sitemap.html　adultinfo：https://adultinfojpn.com/avfuzoku/　FuuAV：https://fuuav.com/allposts/　コウデリ：https://www.koukyuderi.jp/special/avjoyu.html　avfuuzoku：https://avfuuzoku.com/genre_search.php　シティヘブン：https://www.cityheaven.net/tokyo/（地域を限定しない場合は https://www.cityheaven.net/ ）"
        />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <CheckboxField
          label="規約確認済み"
          name="termsConfirmed"
          defaultChecked={source?.termsConfirmed ?? false}
          hint="提供元の了承（文面で保管）を得ているか、規約で自動取得が許されていることを確認しました"
        />
        <CheckboxField label="毎日の自動取り込みを有効にする" name="enabled" defaultChecked={source?.enabled ?? false} />
      </div>
    </div>
  );
}
