type Props = {
  className?: string;
  variant?: "horizontal" | "symbol";
};

export function LogoConfiance({ className = "", variant = "horizontal" }: Props) {
  if (variant === "symbol") {
    // Símbolo em formato de "C": arco escuro de 270° (topo + esquerda + base)
    // abrindo pra direita; arco ciano fecha os 90° restantes.
    // Pontos de transição estão a ±45° do centro (50,50) com raio 38:
    //   ( 50 + 38·cos(±45°), 50 ± 38·sin(45°) ) ≈ (76.87, 23.13) e (76.87, 76.87)
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Confiance Medical"
      >
        <path
          d="M 76.87 23.13 A 38 38 0 1 0 76.87 76.87"
          fill="none"
          stroke="#1F2C4E"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 76.87 23.13 A 38 38 0 0 1 76.87 76.87"
          fill="none"
          stroke="#64C3D1"
          strokeWidth="12"
          strokeLinecap="round"
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
      {/* Símbolo em formato de "C" — mesmo desenho, agora com raio 40 e centrado em (55, 65) */}
      <g transform="translate(55, 65)">
        <path
          d="M 28.28 -28.28 A 40 40 0 1 0 28.28 28.28"
          fill="none"
          stroke="#1F2C4E"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 28.28 -28.28 A 40 40 0 0 1 28.28 28.28"
          fill="none"
          stroke="#64C3D1"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </g>
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
