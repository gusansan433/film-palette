"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ColorWheel } from "@/components/ColorWheel";
import { KandinskyField } from "@/components/KandinskyField";
import { TitleField } from "@/components/TitleField";
import { IntroGate } from "@/components/IntroGate";
import { similarByColor } from "@/lib/similar";
import { creatorLabel } from "@/lib/creator";
import {
  FILTER_CATEGORIES,
  PEOPLE_COUNTS,
  SUBJECTS,
  displayCategoryLabel,
  peopleLabel,
  withSearchTags,
} from "@/lib/classify";
import type { CatalogItem, MediaCategory, PaletteColor, PeopleCount, SubjectTag } from "@/lib/types";
import { summarizeUsageRights } from "@/lib/usageRights";

type SimilarItem = CatalogItem & { matchScore?: number };

type UploadResult = {
  item: CatalogItem;
  similar: SimilarItem[];
  persisted: boolean;
};

type HomeViewProps = {
  initialItems: CatalogItem[];
  initialToday: CatalogItem[];
  lastIngestDate: string | null;
};

type UploadMeta = {
  titleEn: string;
  titleZh: string;
  director: string;
  sourceLabel: string;
};

export function HomeView({ initialItems }: HomeViewProps) {
  const [items, setItems] = useState(initialItems);
  const [picked, setPicked] = useState<{ r: number; g: number; b: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [matched, setMatched] = useState<SimilarItem[] | null>(null);
  const [matchPreview, setMatchPreview] = useState("");
  const [category, setCategory] = useState<MediaCategory | "">("");
  const [people, setPeople] = useState<PeopleCount | "">("");
  const [subject, setSubject] = useState<SubjectTag | "">("");
  const [query, setQuery] = useState("");
  const matchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.items)) setItems(data.items);
      })
      .catch(() => undefined);
    const timer = window.setInterval(() => {
      void fetch("/api/catalog")
        .then((response) => response.json())
        .then((data) => {
          if (Array.isArray(data.items)) setItems(data.items);
        })
        .catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, []);

  const ranked = useMemo(() => {
    if (matched) return matched;
    if (!picked) return items;
    return similarByColor(items, [picked.r, picked.g, picked.b]);
  }, [items, picked, matched]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ranked.filter((item) => {
      const row = withSearchTags(item);
      if (category && row.category !== category) return false;
      if (people && row.people !== people) return false;
      if (subject && !(row.subjects ?? []).includes(subject)) return false;
      if (needle) {
        const blob = `${row.title} ${row.titleEn ?? ""} ${row.titleZh ?? ""} ${row.photographer ?? ""} ${row.director ?? ""}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }
      return true;
    });
  }, [ranked, category, people, subject, query]);

  const subjectOptions = useMemo(() => {
    const used = new Set(items.flatMap((item) => withSearchTags(item).subjects ?? []));
    return SUBJECTS.filter((row) => used.has(row.id));
  }, [items]);

  async function onMatch(file: File) {
    setBusy("正在识别配色…");
    setNotice("");
    setPicked(null);
    const localUrl = URL.createObjectURL(file);
    setMatchPreview(localUrl);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/match", { method: "POST", body: form });
      const data = (await response.json()) as {
        similar?: SimilarItem[];
        error?: string;
      };
      if (!response.ok) {
        setNotice(data.error ?? "识别失败");
        return;
      }
      setMatched(data.similar ?? []);
      setNotice("已按这张图的配色排列画面。图片不会加入图库。");
    } catch {
      setNotice("识别失败，请换一张图试试。");
    } finally {
      setBusy("");
    }
  }

  async function onUpload(file: File, meta: UploadMeta) {
    setBusy("正在加入图库…");
    setNotice("");
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    const form = new FormData();
    form.set("file", file);
    form.set("titleEn", meta.titleEn);
    form.set("titleZh", meta.titleZh);
    form.set("director", meta.director);
    form.set("sourceLabel", meta.sourceLabel);
    form.set("rights", "yes");
    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await response.json()) as UploadResult & { error?: string };
      if (!response.ok) {
        setNotice(data.error ?? "上传失败");
        return;
      }
      const item = {
        ...data.item,
        imageUrl: data.item.imageUrl || localUrl,
        thumbUrl: data.item.thumbUrl || localUrl,
      };
      setItems((current) => {
        if (current.some((entry) => entry.id === item.id)) return current;
        return [item, ...current];
      });
      setMatched(null);
      setSelected(item);
      setSimilar(data.similar ?? []);
      setNotice(data.persisted ? "已加入图库。" : "已收到，但当前环境无法长期保存。");
    } catch {
      setNotice("上传失败，请换一张图试试。");
    } finally {
      setBusy("");
    }
  }

  async function openStill(item: CatalogItem) {
    setSelected(item);
    setPreviewUrl("");
    const response = await fetch(`/api/similar?id=${item.id}`);
    if (response.ok) {
      const data = await response.json();
      setSimilar(data.similar ?? []);
    } else {
      setSimilar([]);
    }
  }

  return (
    <IntroGate>
    <div className="relative z-10 flex min-h-full flex-col">
      <KandinskyField />
      <div className="grain" />
      <header className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-2 px-4 pb-2 pt-8 sm:px-8 sm:pt-10">
        <TitleField count={items.length} />
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1400px] gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <aside data-no-kandi className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs tracking-[0.24em] text-[var(--muted)]">SEARCH BY COLOR</p>
          <ColorWheel
            onPick={(color) => {
              setMatched(null);
              setMatchPreview("");
              setPicked(color);
            }}
          />
          <FilterPanel
            category={category}
            people={people}
            subject={subject}
            query={query}
            subjects={subjectOptions}
            onCategory={setCategory}
            onPeople={setPeople}
            onSubject={setSubject}
            onQuery={setQuery}
          />
          <MatchBox busy={Boolean(busy)} fileRef={matchRef} onFile={(file) => void onMatch(file)} />
          {matchPreview && (
            <div className="overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={matchPreview} alt="用于搜色的图片" className="max-h-32 w-full object-cover" />
              <p className="px-2 py-2 text-[11px] text-[var(--muted)]">仅用于搜色，未加入图库</p>
            </div>
          )}
          <UploadBox
            busy={Boolean(busy)}
            fileRef={fileRef}
            onFile={(file, meta) => void onUpload(file, meta)}
          />
        </aside>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xs tracking-[0.24em] text-[var(--muted)]">
              {matched ? "按图片配色" : picked ? "相近配色" : "画面"}
            </h2>
            <span className="text-[11px] text-[var(--muted)]">{visible.length} 张</span>
          </div>
          {busy && <p className="mb-4 text-sm text-[var(--muted)]">{busy}</p>}
          {notice && <p className="mb-4 text-sm text-[var(--acid)]">{notice}</p>}
          {visible.length === 0 && (
            <p className="text-sm text-[var(--muted)]">没有符合筛选的画面，换一个类型或人数试试。</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openStill(item)}
                className="group relative w-full overflow-hidden bg-black text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbUrl || item.imageUrl || previewUrl}
                  alt={item.title}
                  className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:opacity-80"
                />
                <PaletteRow palette={item.palette} />
                <div className="px-2 py-2 sm:hidden">
                  <FilmCredits item={item} />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-10 opacity-0 transition duration-300 group-hover:opacity-100 sm:block">
                  <FilmCredits item={item} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-10 text-xs leading-6 text-[var(--muted)] sm:px-8 sm:pb-12">
        <p>© 2026 Open Palette · filmpalette.art</p>
        <p className="mt-2 max-w-2xl">
          画面来自 Flickr、维基共享资源、Openverse、美国国会图书馆、互联网档案馆、大都会艺术博物馆等公有领域及自由许可作品，以及用户标注出处后上传的画面。版权归原作者及权利人所有。标明出处不等于获得授权。
        </p>
        <p className="mt-2">本网站由 Hewitt-sansan-tmoW 搭建</p>
        <p className="mt-2">
          问题反馈请发邮件至{" "}
          <a
            href="mailto:huangwanyun3@qq.com"
            className="underline decoration-[var(--line)]"
          >
            huangwanyun3@qq.com
          </a>
        </p>
      </footer>

      {selected && (
        <Lightbox
          item={selected}
          similar={similar}
          previewUrl={previewUrl}
          onClose={() => setSelected(null)}
          onOpen={(item) => void openStill(item)}
        />
      )}
    </div>
    </IntroGate>
  );
}

function UsageRightsLine({ item }: { item: CatalogItem }) {
  const usage = summarizeUsageRights(item);
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-[var(--acid)]">使用</dt>
      <dd
        className="line-clamp-2 text-[10px] leading-4 text-[var(--muted)]"
        title={usage.detail}
      >
        {usage.short}
      </dd>
    </div>
  );
}

function FilmCredits({ item }: { item: CatalogItem }) {
  const tagged = withSearchTags(item);
  const tags = [displayCategoryLabel(tagged.category), peopleLabel(tagged.people)].filter(Boolean).join(" · ");
  if (item.kind === "photo") {
    return (
      <dl className="mt-2 space-y-1 text-[11px] leading-5 text-[var(--muted)]">
        <div className="flex gap-2">
          <dt className="shrink-0 text-[var(--acid)]">来源</dt>
          <dd className="truncate text-[var(--paper)]">
            {item.sourceLabel || "未注明"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-[var(--acid)]">{creatorLabel(item.title, item.kind)}</dt>
          <dd className="truncate text-[var(--paper)]">
            {item.photographer || item.author || "未注明"}
          </dd>
        </div>
        <UsageRightsLine item={item} />
        {tags ? <p className="pt-1 text-[10px] tracking-[0.12em] text-[var(--muted)]">{tags}</p> : null}
      </dl>
    );
  }
  return (
    <dl className="mt-2 space-y-1 text-[11px] leading-5 text-[var(--muted)]">
      <div className="flex gap-2">
        <dt className="shrink-0 text-[var(--acid)]">英文名</dt>
        <dd className="truncate text-[var(--paper)]">{item.titleEn || item.title || "未注明"}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-[var(--acid)]">中文名</dt>
        <dd className="truncate text-[var(--paper)]">{item.titleZh || "未注明"}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-[var(--acid)]">导演</dt>
        <dd className="truncate text-[var(--paper)]">{item.director || "未注明"}</dd>
      </div>
      {(item.source === "user" || item.sourceLabel) && (
        <div className="flex gap-2">
          <dt className="shrink-0 text-[var(--acid)]">来源</dt>
          <dd className="truncate text-[var(--paper)]">{item.sourceLabel || "用户上传"}</dd>
        </div>
      )}
      <UsageRightsLine item={item} />
      {tags ? <p className="pt-1 text-[10px] tracking-[0.12em] text-[var(--muted)]">{tags}</p> : null}
    </dl>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-1 text-[11px] ${
        active
          ? "border-[var(--acid)] text-[var(--acid)]"
          : "border-[var(--line)] text-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}

function FilterPanel({
  category,
  people,
  subject,
  query,
  subjects,
  onCategory,
  onPeople,
  onSubject,
  onQuery,
}: {
  category: MediaCategory | "";
  people: PeopleCount | "";
  subject: SubjectTag | "";
  query: string;
  subjects: { id: SubjectTag; label: string }[];
  onCategory: (value: MediaCategory | "") => void;
  onPeople: (value: PeopleCount | "") => void;
  onSubject: (value: SubjectTag | "") => void;
  onQuery: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs tracking-[0.24em] text-[var(--muted)]">SEARCH BY TYPE</p>
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="关键词：莫奈、夜景、剧照…"
        className="w-full border border-[var(--line)] bg-transparent px-2 py-2 text-sm text-[var(--paper)] outline-none"
      />
      {FILTER_CATEGORIES.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] text-[var(--muted)]">类型</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!category} onClick={() => onCategory("")}>
              全部
            </Chip>
            {FILTER_CATEGORIES.map((row) => (
              <Chip
                key={row.id}
                active={category === row.id}
                onClick={() => onCategory(category === row.id ? "" : row.id)}
              >
                {row.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-2 text-[11px] text-[var(--muted)]">人数</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!people} onClick={() => onPeople("")}>
            全部
          </Chip>
          {PEOPLE_COUNTS.map((row) => (
            <Chip
              key={row.id}
              active={people === row.id}
              onClick={() => onPeople(people === row.id ? "" : row.id)}
            >
              {row.label}
            </Chip>
          ))}
        </div>
      </div>
      {subjects.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] text-[var(--muted)]">内容</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!subject} onClick={() => onSubject("")}>
              全部
            </Chip>
            {subjects.map((row) => (
              <Chip
                key={row.id}
                active={subject === row.id}
                onClick={() => onSubject(subject === row.id ? "" : row.id)}
              >
                {row.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaletteRow({ palette }: { palette: PaletteColor[] }) {
  return (
    <div className="mt-1 flex h-2 overflow-hidden">
      {palette.map((swatch) => (
        <span
          key={swatch.hex + swatch.ratio}
          style={{ background: swatch.hex, width: `${Math.max(swatch.ratio * 100, 8)}%` }}
        />
      ))}
    </div>
  );
}

function MatchBox({
  busy,
  fileRef,
  onFile,
}: {
  busy: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <div
      className="rounded-md border border-dashed border-[var(--acid)]/45 bg-[rgba(45,223,204,0.05)] px-4 py-5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <p className="text-xs tracking-[0.24em] text-[var(--acid)]">以图识图</p>
      <label
        className={`mt-3 flex min-h-[7.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-[var(--acid)]/55 bg-[rgba(45,223,204,0.08)] px-4 py-6 text-center transition-colors hover:border-[var(--acid)]/80 hover:bg-[rgba(45,223,204,0.12)] ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="text-sm tracking-[0.12em] text-[var(--acid)]">
          {busy ? "正在识别…" : "选择图片"}
        </span>
        <span className="text-[11px] leading-5 text-[var(--muted)]">
          或将图片拖放到此处
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      </label>
      <p className="mt-3 text-sm leading-6 text-[var(--paper)]">
        您的照片只会被用来提取颜色，以搜寻站内颜色相近的图片，不会被放进图库。
      </p>
    </div>
  );
}

function UploadBox({
  busy,
  fileRef,
  onFile,
}: {
  busy: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File, meta: UploadMeta) => void;
}) {
  const [titleEn, setTitleEn] = useState("");
  const [director, setDirector] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [rights, setRights] = useState(false);
  const [hint, setHint] = useState("");

  function submit(file: File) {
    if (titleEn.trim().length < 2) {
      setHint("请先填写标题。");
      return;
    }
    if (sourceLabel.trim().length < 2) {
      setHint("请先填写来源。");
      return;
    }
    if (!rights) {
      setHint("请确认你有权上传这张图。");
      return;
    }
    setHint("");
    onFile(file, {
      titleEn: titleEn.trim(),
      titleZh: "",
      director: director.trim(),
      sourceLabel: sourceLabel.trim(),
    });
  }

  return (
    <form
      className="space-y-3 rounded-md border border-dashed border-[var(--acid)]/40 bg-[rgba(45,223,204,0.05)] px-4 py-5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) submit(file);
      }}
      onSubmit={(event) => event.preventDefault()}
    >
      <p className="text-xs tracking-[0.24em] text-[var(--acid)]">上传图片</p>
      <p className="text-sm leading-6 text-[var(--paper)]">
        请注明来源（只上传您有权使用的图片）
      </p>
      <label className="block text-[11px] text-[var(--muted)]">
        标题
        <input
          value={titleEn}
          onChange={(event) => setTitleEn(event.target.value)}
          required
          className="mt-1 w-full border border-[var(--line)] bg-transparent px-2 py-2 text-sm text-[var(--paper)] outline-none"
          placeholder="Nosferatu / 星夜 / 来源作品名"
        />
      </label>
      <label className="block text-[11px] text-[var(--muted)]">
        来源
        <input
          value={sourceLabel}
          onChange={(event) => setSourceLabel(event.target.value)}
          required
          className="mt-1 w-full border border-[var(--line)] bg-transparent px-2 py-2 text-sm text-[var(--paper)] outline-none"
          placeholder="维基共享资源、Flickr 链接，或作者 / 出处"
        />
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-5 text-[var(--muted)]">
        <input
          type="checkbox"
          checked={rights}
          onChange={(event) => setRights(event.target.checked)}
          className="mt-0.5"
        />
        我确认这张图是公有领域、已获授权，或由我拍摄/持有权利。
      </label>
      <label className="block text-[11px] text-[var(--muted)]">
        导演（可选）
        <input
          value={director}
          onChange={(event) => setDirector(event.target.value)}
          className="mt-1 w-full border border-[var(--line)] bg-transparent px-2 py-2 text-sm text-[var(--paper)] outline-none"
          placeholder="（如果您的图片来自于某部电影）"
        />
      </label>
      {hint && <p className="text-[11px] text-[var(--acid)]">{hint}</p>}
      <label className="mt-1 flex min-h-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-[var(--acid)]/50 bg-[rgba(45,223,204,0.06)] px-3 py-4 text-center transition-colors hover:border-[var(--acid)]/75 hover:bg-[rgba(45,223,204,0.1)]">
        <span className="text-sm tracking-[0.12em] text-[var(--acid)]">
          {busy ? "正在处理…" : "选择图片"}
        </span>
        <span className="text-[11px] text-[var(--muted)]">或拖放到此处</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) submit(file);
            event.target.value = "";
          }}
        />
      </label>
    </form>
  );
}

function Lightbox({
  item,
  similar,
  previewUrl,
  onClose,
  onOpen,
}: {
  item: CatalogItem;
  similar: SimilarItem[];
  previewUrl: string;
  onClose: () => void;
  onOpen: (item: CatalogItem) => void;
}) {
  const src = item.imageUrl || previewUrl;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,21,17,0.88)] p-4">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        data-no-kandi
        className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-auto border border-[var(--blood)] bg-[var(--bg)] p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.24em] text-[var(--muted)]">
              {item.source === "user"
                ? "USER UPLOAD"
                : item.kind === "photo"
                  ? "PUBLIC IMAGE"
                  : "PUBLIC DOMAIN STILL"}
            </p>
            <h3 className="display mt-1 text-3xl">
              {item.kind === "photo" ? item.title : item.titleEn || item.title}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-[var(--acid)]">
            关闭
          </button>
        </div>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.title} className="mt-4 max-h-[46vh] w-full object-contain bg-black" />
        )}
        <PaletteRow palette={item.palette} />
        <div className="mt-3">
          <FilmCredits item={item} />
        </div>
        {item.pageUrl && (
          <a
            href={item.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-[var(--acid)] underline decoration-[var(--blood)]"
          >
            查看来源与许可
          </a>
        )}
        {similar.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs tracking-[0.24em] text-[var(--muted)]">相近配色</h4>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {similar.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onOpen(entry)}
                  className="text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.thumbUrl || entry.imageUrl}
                    alt={entry.title}
                    className="aspect-[16/9] w-full object-cover bg-black"
                  />
                  <FilmCredits item={entry} />
                  {typeof entry.matchScore === "number" && (
                    <p className="text-[10px] text-[var(--muted)]">相近 {entry.matchScore}%</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
