import { redirect } from "next/navigation";
import { LandingGate } from "@/components/marketing/LandingGate";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

const toSearchParams = (params?: SearchParams) => {
  const query = new URLSearchParams();
  if (!params) {
    return query;
  }
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string") {
          query.append(key, entry);
        }
      });
    } else if (typeof value === "string") {
      query.append(key, value);
    }
  }
  return query;
};

export default async function RootPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const params = toSearchParams(resolved);
  if (params.has("group_id")) {
    redirect(`/split?${params.toString()}`);
  }
  return <LandingGate />;
}
