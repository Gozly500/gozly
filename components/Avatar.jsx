"use client";

import { useId } from "react";
import { TOILE, avatarParDefaut, normaliserAvatar, pieceParId } from "@/lib/avatar";

// Réglages de dessin communs à tous les SVG de l'équipe (ceux du dossier Avatard les avaient sur la racine).
const STYLE_SVG = { fillRule: "evenodd", clipRule: "evenodd", strokeLinejoin: "round", strokeMiterlimit: 2 };

// Les formes de découpe des yeux portent le même nom dans tous les fichiers : on les rend uniques pour cet avatar,
// sinon deux avatars à l'écran se découperaient l'un avec les formes de l'autre.
const uniques = (contenu, uid) => contenu.replace(/_clip(\d+)/g, `${uid}c$1`);

// Avatar d'une personne. `valeur` : avatar sauvegardé (ou null) ; `nom` : donne un avatar de départ stable si valeur est vide.
// Quand un chapeau dépasse en haut, l'image se recadre pour le montrer en entier (la tête paraît alors un peu plus petite).
export default function Avatar({ valeur, nom = "", taille = 40, className = "", titre }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const a = normaliserAvatar(valeur) || avatarParDefaut(nom);

  const corps = pieceParId("corps", "corps");
  const yeux = pieceParId("yeux", a.yeux);
  const bouche = pieceParId("bouche", a.bouche);
  const chapeau = a.chapeau ? pieceParId("chapeaux", a.chapeau) : null;
  const lunettes = a.lunettes ? pieceParId("lunettes", a.lunettes) : null;

  const haut = chapeau ? Math.max(0, Math.min(chapeau.haut - 14, TOILE.decalageTete)) : TOILE.decalageTete;
  const hauteur = TOILE.hauteur - haut;

  const html = (p) => ({ __html: uniques(p.contenu, uid) });
  // Les verres des lunettes sont en blanc à 40 % ; « soleil » les passe au noir.
  const verres = lunettes ? (a.lunettesType === "soleil" ? lunettes.contenu.replace(/fill:white/g, "fill:black") : lunettes.contenu) : "";

  return (
    <svg
      className={`avatar ${className}`.trim()}
      viewBox={`0 ${haut} ${TOILE.largeur} ${hauteur}`}
      width={taille}
      height={taille}
      role="img"
      aria-label={titre || nom || "Avatar"}
      style={STYLE_SVG}
    >
      <g transform={`translate(0 ${TOILE.decalageTete})`}>
        <g dangerouslySetInnerHTML={{ __html: corps.contenu.replace(/fill:white/g, `fill:${a.corps}`) }} />
        <g dangerouslySetInnerHTML={html(yeux)} />
        <g dangerouslySetInnerHTML={html(bouche)} />
      </g>
      {lunettes && <g transform={lunettes.placement ? `translate(${lunettes.placement.x} ${lunettes.placement.y})` : undefined} dangerouslySetInnerHTML={{ __html: verres }} />}
      {chapeau && <g fill={chapeau.couleur ? a.chapeauCouleur : undefined} dangerouslySetInnerHTML={html(chapeau)} />}
    </svg>
  );
}
