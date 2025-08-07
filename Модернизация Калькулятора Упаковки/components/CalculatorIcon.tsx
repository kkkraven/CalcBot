export function CalculatorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="8"
        y="4"
        width="24"
        height="32"
        rx="4"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="12"
        y="8"
        width="16"
        height="4"
        rx="2"
        fill="currentColor"
      />
      <circle cx="14" cy="16" r="2" fill="currentColor" />
      <circle cx="20" cy="16" r="2" fill="currentColor" />
      <circle cx="26" cy="16" r="2" fill="currentColor" />
      <circle cx="14" cy="22" r="2" fill="currentColor" />
      <circle cx="20" cy="22" r="2" fill="currentColor" />
      <circle cx="26" cy="22" r="2" fill="currentColor" />
      <circle cx="14" cy="28" r="2" fill="currentColor" />
      <circle cx="20" cy="28" r="2" fill="currentColor" />
      <circle cx="26" cy="28" r="2" fill="currentColor" />
    </svg>
  );
}