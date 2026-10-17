"use client";

import { useId } from "react";

// Gozyx, la mascotte de Gozly, en SVG animé (forme exacte du fichier « Gozyx pupille détacher.svg »).
// Les parties (tête, yeux, pupilles, bouche) sont des groupes séparés pour pouvoir les animer en CSS
// (voir les règles .gx-* dans globals.css). Les animations s'arrêtent si la personne a demandé moins de mouvement.
//
// humeur : "normal" (cligne, regarde autour) | "probleme" (inquiet) | "panne" (affolé) | "perplexe" (bouche en ligne) | "dort" | "content"
// taille : largeur en pixels (ou toute valeur CSS)

const OEIL = "M160.215,167.181C201.224,167.181 234.518,200.475 234.518,241.484L234.518,490.707C234.518,531.716 201.224,565.01 160.215,565.01C119.206,565.01 85.912,531.716 85.912,490.707L85.912,241.484C85.912,200.475 119.206,167.181 160.215,167.181Z";
const PUPILLE = "M160.215,167.181C201.224,167.181 234.518,205.746 234.518,253.248L234.518,478.943C234.518,526.444 201.224,565.01 160.215,565.01C119.206,565.01 85.912,526.444 85.912,478.943L85.912,253.248C85.912,205.746 119.206,167.181 160.215,167.181Z";
const BOUCHE =
  "M747.008,979.764C762.099,979.764 776.071,985.992 783.771,996.15C791.472,1006.308 791.759,1018.892 784.528,1029.259C745.153,1086.083 660.477,1124.537 564.021,1124.537C467.565,1124.537 382.889,1086.083 343.526,1029.254C336.298,1018.89 336.585,1006.31 344.283,996.156C351.981,986.001 365.948,979.775 381.033,979.775C474.025,979.764 654.017,979.764 747.008,979.764Z";

export default function Gozyx({ humeur = "normal", taille = 120, className = "", titre = "Gozyx" }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      className={`gozyx gozyx-${humeur} ${className}`}
      viewBox="0 0 877 877"
      style={{ width: typeof taille === "number" ? `${taille}px` : taille, height: "auto", overflow: "visible" }}
      role="img"
      aria-label={titre}
      xmlns="http://www.w3.org/2000/svg"
      fillRule="evenodd"
      clipRule="evenodd"
    >
      <defs>
        <linearGradient id={`gx-fond-${gid}`} x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,770.889797,-770.889797,0,646.27816,220.837662)">
          <stop offset="0" stopColor="rgb(72,0,255)" />
          <stop offset="1" stopColor="rgb(27,0,95)" />
        </linearGradient>
      </defs>

      <g transform="matrix(1,0,0,1,-152.475207,-152.475207)">
        <g className="gx-tete">
          <g transform="matrix(0.992944,-0.118586,0.118586,0.992944,-124.594074,52.371549)">
            <circle cx="646.278" cy="619.189" r="438.076" fill={`url(#gx-fond-${gid})`} />
          </g>

          {/* œil gauche : blanc + pupille */}
          <g className="gx-oeil">
            <g transform="matrix(1,0,0,1,260.538615,155.569145)">
              <path d={OEIL} fill="white" />
            </g>
            <g className="gx-pupille gx-pupille-g">
              <g transform="matrix(0.560248,0,0,0.48367,330.993451,344.595044)">
                <path d={PUPILLE} fill="black" />
              </g>
            </g>
          </g>

          {/* œil droit */}
          <g className="gx-oeil gx-oeil-d">
            <g transform="matrix(1,0,0,1,600.133898,152.626032)">
              <path d={OEIL} fill="white" />
            </g>
            <g className="gx-pupille gx-pupille-d">
              <g transform="matrix(0.560248,0,0,0.48367,670.588734,341.651932)">
                <path d={PUPILLE} fill="black" />
              </g>
            </g>
          </g>

          <g className="gx-bouche">
            <g transform="matrix(0.797793,0,0,1.019207,140.573587,-208.84165)">
              <path d={BOUCHE} fill="white" />
            </g>
          </g>

          {/* Bouche ouverte (simple rond), visible seulement quand Gozyx dort */}
          <ellipse className="gx-bouche-o" cx="593" cy="852" rx="46" ry="54" fill="white" />

          {/* Bouche en simple ligne droite, visible seulement quand Gozyx est perplexe (il cherche sans trouver) */}
          <rect className="gx-bouche-ligne" x="483" y="838" width="220" height="30" rx="15" fill="white" />
        </g>
      </g>

      {/* Détails selon l'humeur (visibles seulement dans certaines humeurs, voir le CSS) */}
      <path className="gx-goutte" aria-hidden="true" d="M790 110 C790 110 735 185 735 225 C735 257 759 280 790 280 C821 280 845 257 845 225 C845 185 790 110 790 110 Z" fill="#7dd3fc" />
      <g className="gx-zzz" aria-hidden="true" fill="#c9cdfb" fontFamily="inherit" fontWeight="700">
        <text x="700" y="140" fontSize="120" className="gx-z1">z</text>
        <text x="780" y="70" fontSize="90" className="gx-z2">z</text>
        <text x="840" y="10" fontSize="64" className="gx-z3">z</text>
      </g>
    </svg>
  );
}
