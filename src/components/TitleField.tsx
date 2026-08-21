export function TitleField({ count }: { count: number }) {
  return (
    <div className="relative py-2">
      <p className="text-[11px] tracking-[0.28em] text-[var(--muted)] uppercase">
        Search by color
      </p>
      <h1 className="display relative mt-2 text-4xl leading-none sm:text-6xl">
        Open Palette
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
        点选颜色，找到近似颜色的照片；也可以按人数等内容筛选。
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        目前图库 {count} 张 · 每天北京时间 8:00 更新约 100 张
      </p>
    </div>
  );
}
