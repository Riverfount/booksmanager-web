/** Logomarca: três livros em uma estante, um deles inclinado (acabou de ser emprestado). */
export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
    <rect width="64" height="64" rx="14" fill="#3c3836" />
    <rect x="13" y="20" width="9" height="30" rx="2" fill="#fabd2f" />
    <rect x="25" y="14" width="9" height="36" rx="2" fill="#fe8019" />
    <rect x="37.5" y="19" width="9" height="31" rx="2" fill="#8ec07c" transform="rotate(14 42 50)" />
    <rect x="10" y="50" width="44" height="3.5" rx="1.75" fill="#ebdbb2" />
    <rect x="15.5" y="26" width="4" height="2.2" rx="1" fill="#3c3836" />
    <rect x="27.5" y="21" width="4" height="2.2" rx="1" fill="#3c3836" />
  </svg>
)
