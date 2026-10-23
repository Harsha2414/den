import ScopeHome from "@/components/ScopeHome";

export default async function IndiaPage({ searchParams }: { searchParams: Promise<{ tab?: string; new?: string }> }) {
  const { tab, new: startNew } = await searchParams;
  return <ScopeHome key={`india:${tab || ""}`} scope="india" initialTab={tab} startComposing={startNew === "1"} />;
}
