import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

const serializeParams = (params?: SearchParams) => {
  const url = new URLSearchParams();
  if (!params) {
    return url;
  }
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string") {
          url.append(key, entry);
        }
      });
    } else if (typeof value === "string") {
      url.append(key, value);
    }
  }
  return url;
};

export default async function RootPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const params = serializeParams(resolved);
  const hasGroupId = params.has("group_id");
  const target = hasGroupId ? "/split" : "/dashboard";
  const query = params.toString();
  redirect(query ? `${target}?${query}` : target);
}
