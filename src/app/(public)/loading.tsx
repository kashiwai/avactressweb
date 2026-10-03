export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="読み込み中">
      <div className="skeleton h-32 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
