import { loadCatalog, pickToday } from "@/lib/catalog";
import { HomeView } from "@/components/HomeView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await loadCatalog();
  return (
    <HomeView
      initialItems={catalog.items}
      initialToday={pickToday(catalog.items, 10)}
      lastIngestDate={catalog.lastIngestDate}
    />
  );
}
