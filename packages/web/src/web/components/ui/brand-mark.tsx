// BRASAO PROVISORIO — desenho autoral em SVG, criado apenas para a demonstracao.
// PONTO DE SUBSTITUICAO: trocar este componente pelo logotipo oficial da Valhalla Choperia
// em alta resolucao (SVG ou PNG com fundo transparente) fornecido pelo estabelecimento.
// Enquanto isso, a interface mantem o rotulo "brasao provisorio" ao lado da marca.

import { useId } from "react";

export function BrandMark({ className = "" }: { className?: string }) {
  const tituloId = useId();

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-labelledby={tituloId}
      fill="none"
    >
      <title id={tituloId}>Brasão provisório da Valhalla</title>
      {/* fio externo e interno do selo */}
      <circle cx="24" cy="24" r="22.2" stroke="currentColor" strokeOpacity="0.55" />
      <circle cx="24" cy="24" r="18.6" stroke="currentColor" strokeOpacity="0.9" />

      {/* cabos dos machados cruzados */}
      <path d="M12.6 33.8 32.2 12.6M35.4 33.8 15.8 12.6" stroke="currentColor" strokeOpacity="0.5" />
      {/* laminas */}
      <path
        d="M30.4 10.6c2.6-.4 4.8.6 5.8 2.6-2 .6-3.2 1.8-3.6 3.6-1.8-1.8-2.6-3.8-2.2-6.2Z"
        stroke="currentColor"
        strokeOpacity="0.75"
      />
      <path
        d="M17.6 10.6c-2.6-.4-4.8.6-5.8 2.6 2 .6 3.2 1.8 3.6 3.6 1.8-1.8 2.6-3.8 2.2-6.2Z"
        stroke="currentColor"
        strokeOpacity="0.75"
      />

      {/* elmo com protetor nasal */}
      <path
        d="M15.4 26.4c0-5.2 3.8-8.8 8.6-8.8s8.6 3.6 8.6 8.8v2.2h-17.2v-2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M24 17.8v18M15.4 28.6h17.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M18.4 31.4h3.4M26.2 31.4h3.4" stroke="currentColor" strokeOpacity="0.8" />
    </svg>
  );
}
