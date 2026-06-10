// components/LoadingSpinner.tsx

export function LoadingSpinner() {
  return (
    <div className="lingo-spinner">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="lingo-spinner-svg"
      >
        <circle
          cx="7"
          cy="7"
          r="5"
          stroke="#cbd5e1"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M12 7a5 5 0 0 0-5-5"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
