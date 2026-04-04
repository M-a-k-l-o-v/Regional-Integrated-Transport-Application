import AppShell from "../components/AppShell";
import BoardsDirectory from "../components/BoardsDirectory";
import PageHeader from "../components/PageHeader";

export const dynamic = "force-dynamic";

type BoardsPageProps = {
  searchParams?: Promise<{
    mode?: string;
  }>;
};

export default async function BoardsPage({ searchParams }: BoardsPageProps) {
  const params = (await searchParams) ?? {};
  const initialMode = params.mode === "rail" ? "rail" : "bus";

  return (
    <AppShell activePath="boards">
      <PageHeader
        eyebrow="Boards"
        title="Open a bus or rail board by location"
        description="Pick the board type first, return to recently checked locations, or search by place name to open another scheduled board."
      />

      <BoardsDirectory initialMode={initialMode} />
    </AppShell>
  );
}
