import Link from "next/link";

export function SubPageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 py-2">
      <Link
        href="/"
        aria-label="Back to timer"
        data-testid="back-to-timer"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted transition active:scale-95 hover:text-chalk"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
          <path d="M14.5 5.5 8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <h1 className="text-sm uppercase tracking-[0.35em] text-chalk">{title}</h1>
    </header>
  );
}
