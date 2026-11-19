import { Link } from "react-router";

type LogoProps = {
  to?: string | null;
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
};

const heights = { sm: 27, md: 34, lg: 44 } as const;

export default function LogiGoLogo({
  to = "/",
  tone = "light",
  size = "md",
  className = "",
  onClick,
}: LogoProps) {
  const height = heights[size];
  const content = (
    <>
      <img
        src="/images/safar-mark.png"
        alt=""
        width={102}
        height={120}
        className="max-w-none shrink-0"
        style={{ height, width: "auto" }}
      />
      <span className="inline-flex">
        <img
          src="/images/safar-wordmark.png"
          alt=""
          width={249}
          height={120}
          className="max-w-none shrink-0"
          style={{ height, width: "auto" }}
        />
      </span>
    </>
  );

  const backing = tone === "light" ? "rounded-lg bg-[#faf5e9] p-1.5" : "";
  const base = `inline-flex w-fit items-center gap-2 ${backing} ${className}`;
  if (to === null) return <span role="img" aria-label="Safar Logistics" className={base}>{content}</span>;

  return (
    <Link to={to} onClick={onClick} className={base} aria-label="Safar Logistics home">
      {content}
    </Link>
  );
}
