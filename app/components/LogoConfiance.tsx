type Props = {
  className?: string;
  variant?: "horizontal" | "symbol";
};

export function LogoConfiance({ className = "", variant = "horizontal" }: Props) {
  if (variant === "symbol") {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Confiance Medical"
      >
        <circle cx="50" cy="50" r="38" fill="none" stroke="#1F2C4E" strokeWidth="12" />
        <path
          d="M 50 88 A 38 38 0 0 0 88 50"
          fill="none"
          stroke="#64C3D1"
          strokeWidth="12"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 480 130"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Confiance Medical"
    >
      {/* Símbolo: anel azul marinho com arco ciano no canto inferior-direito */}
      <g transform="translate(55, 65)">
        <circle cx="0" cy="0" r="40" fill="none" stroke="#1F2C4E" strokeWidth="12" />
        <path
          d="M 0 40 A 40 40 0 0 0 40 0"
          fill="none"
          stroke="#64C3D1"
          strokeWidth="12"
        />
      </g>
      {/* Wordmark */}
      <text
        x="125"
        y="62"
        fontFamily="Montserrat, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="42"
        letterSpacing="-1"
        fill="#1F2C4E"
      >
        CONFIANCE
      </text>
      <text
        x="125"
        y="105"
        fontFamily="Montserrat, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="34"
        letterSpacing="-0.5"
        fill="#64C3D1"
      >
        MEDICAL
      </text>
    </svg>
  );
}
