import ScopeHome from "@/components/ScopeHome";

export default async function IndiaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ScopeHome key="india" scope="india" initialTab={tab} />;
}
