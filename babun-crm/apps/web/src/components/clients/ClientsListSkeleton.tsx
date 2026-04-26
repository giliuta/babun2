// Loading skeleton for /dashboard/clients while the list is being
// fetched from Supabase. Renders a handful of grouped placeholder
// rows so the page doesn't flash empty between mount and first data.

const SHIMMER =
  "animate-pulse bg-[var(--fill-quaternary)] rounded";

function Row({ widthRem }: { widthRem: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--separator)]">
      <div className={`${SHIMMER} w-10 h-10 rounded-full`} />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={`${SHIMMER} h-3.5`} style={{ width: `${widthRem}rem` }} />
        <div className={`${SHIMMER} h-2.5 w-24`} />
      </div>
    </div>
  );
}

function GroupHeader({ letter }: { letter: string }) {
  return (
    <div className="px-4 pt-4 pb-1 text-[12px] font-semibold uppercase text-[var(--label-tertiary)] tracking-wider">
      {letter}
    </div>
  );
}

export default function ClientsListSkeleton() {
  return (
    <div className="flex-1 overflow-hidden">
      <GroupHeader letter="А" />
      <Row widthRem={9} />
      <Row widthRem={11} />
      <Row widthRem={8} />
      <GroupHeader letter="Б" />
      <Row widthRem={10} />
      <Row widthRem={7} />
      <GroupHeader letter="В" />
      <Row widthRem={12} />
      <Row widthRem={9} />
    </div>
  );
}
