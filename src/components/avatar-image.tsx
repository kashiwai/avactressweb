"use client";
// 女優の写真。読み込みに失敗したときは頭文字の表示に切り替える（壊れた画像アイコンを出さない）
import { useState } from "react";

export function AvatarImage({
  name,
  src,
  fallbackSrc,
  size,
  className = "rounded-lg",
  position = "top",
}: {
  name: string;
  src: string;
  fallbackSrc?: string;
  size: number;
  className?: string;
  position?: "top" | "center";
}) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  if (failed) return <AvatarFallback name={name} size={size} className={className} />;
  return (
    // 外部画像（DMM・DUGA等）のため next/image は使わない。referrerPolicy を外すと画像側で弾かれることがある
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={name}
      width={size}
      height={size}
      className={`size-full object-cover ${position === "center" ? "object-center" : "object-top"} ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        // 小さい画像（DUGAの240x180）が無いときは、元の画像に一度だけ切り替える
        if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc);
        else setFailed(true);
      }}
    />
  );
}

export function AvatarFallback({ name, size, className = "rounded-lg" }: { name: string; size: number; className?: string }) {
  return (
    <span
      className={`flex size-full shrink-0 items-center justify-center bg-gradient-to-br from-rose-100 to-pink-50 font-bold text-rose-700 ${className}`}
      style={{ fontSize: Math.max(11, size / 2.8) }}
      aria-hidden
    >
      {name.replace(/^[☆★♡♥♪◆■※\s　]+/, "").trim().slice(0, 1) || "?"}
    </span>
  );
}
