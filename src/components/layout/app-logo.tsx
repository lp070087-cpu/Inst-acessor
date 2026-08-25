export function AppLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 font-display text-[19px] font-bold tracking-tight select-none">
      <span className="grid w-10 h-10 place-items-center rounded-[12px] bg-brand-grad text-white shadow-brand">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 11l4-5 4 3 5-7 5 9" />
          <path d="M3 19h18" />
          <path d="M12 8l2 3 3 1" />
        </svg>
      </span>
      <span className="text-ink">
        Inst <em className="not-italic text-grad font-extrabold">Acessor</em>
      </span>
    </span>
  );
}
