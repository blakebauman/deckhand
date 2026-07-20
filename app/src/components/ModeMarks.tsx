/** Compact runtime marks for the sidebar mode switcher. */

export function DockerMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="11" width="4" height="3.5" rx="0.6" />
      <rect x="8" y="11" width="4" height="3.5" rx="0.6" />
      <rect x="13" y="11" width="4" height="3.5" rx="0.6" />
      <rect x="8" y="6.5" width="4" height="3.5" rx="0.6" />
      <rect x="13" y="6.5" width="4" height="3.5" rx="0.6" />
      <path
        d="M19 12.5c1.2.2 2 1.1 2 2.2H3c0-1.5 1.1-2.7 2.6-2.9.4-1.5 1.8-2.6 3.5-2.6.5 0 1 .1 1.4.3C11.2 8.2 12.5 7.5 14 7.5c1.8 0 3.3 1.2 3.7 2.8.4-.1.8-.1 1.3 0z"
        opacity="0.35"
      />
    </svg>
  );
}

export function KubernetesMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="5.1" y1="8" x2="18.9" y2="16" />
      <line x1="5.1" y1="16" x2="18.9" y2="8" />
    </svg>
  );
}

export function MicroVMMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="12" rx="2" />
      <path d="M8 20h8M12 17v3" />
    </svg>
  );
}
