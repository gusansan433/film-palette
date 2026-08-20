export function TitleField() {
  return (
    <div className="relative py-2">
      <p className="text-[11px] tracking-[0.28em] text-[var(--muted)] uppercase">
        Search by color
      </p>
      <h1 className="display relative mt-2 text-4xl leading-none sm:text-6xl">
        Film Palette
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
        点颜色搜图，也可以按类型、人数和内容筛。剧照、摄影、海报、名画都可以。
      </p>
    </div>
  );
}
