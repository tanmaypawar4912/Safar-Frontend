import { Link } from "react-router";

type LogoProps = {
  /** Where the logo links to. Pass `null` to render a non-clickable logo. */
  to?: string | null;
  /** Wordmark colour: light text for dark backgrounds, dark text for light backgrounds. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  className?: string;
  onClick?: () => void;
};

/** The orange LogiGo "route" mark, drawn as inline SVG so it needs no image file. */
export function LogiGoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M29.5 9.2C27.2 6.9 24 5.6 20.4 5.6 14 5.6 9.3 9.7 9.3 15c0 4.2 2.9 6.6 7.7 8l4.4 1.3c2.4.7 3.5 1.7 3.5 3.3 0 2-2 3.4-5 3.4-2.8 0-5.2-1.1-7-2.9"
        stroke="#ff6a13"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31.5" cy="31.5" r="3.2" fill="#ff6a13" />
    </svg>
  );
}

const sizes = {
  sm: { mark: 24, text: "text-[17px]" },
  md: { mark: 30, text: "text-[21px]" },
  lg: { mark: 38, text: "text-[27px]" },
} as const;

export default function LogiGoLogo({
  to = "/",
  tone = "light",
  size = "md",
  subtitle,
  className = "",
  onClick,
}: LogoProps) {
  const dims = sizes[size];
  const content = (
    <>
      <LogiGoMark size={dims.mark} />
      <span className="flex flex-col leading-none">
        <span
          className={`${dims.text} font-extrabold tracking-[-0.04em] ${
            tone === "light" ? "text-white" : "text-[#0e1929]"
          }`}
        >
          LogiGo
        </span>
        {subtitle && (
          <span
            className={`mt-1 text-[9px] font-bold uppercase tracking-[0.18em] ${
              tone === "light" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </>
  );

  const base = `inline-flex items-center gap-2 ${className}`;

  if (to === null) return <span className={base}>{content}</span>;

  return (
    <Link to={to} onClick={onClick} className={base} aria-label="LogiGo home">
      {content}
    </Link>
  );
}
