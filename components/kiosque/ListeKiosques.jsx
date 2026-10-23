"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconEcran } from "@/components/icons/Pictogrammes";
import { deposerInstantane } from "@/lib/transitionKiosque";

const DUREE_EXPANSION_MS = 480; // la carte s'agrandit ; « Chargement… » apparaît juste après
const DELAI_LENT_MS = 8000; // depuis le toucher : au bout de ce temps, on dit que c'est plus long que d'habitude
const HAUTEUR_PLEIN_MIN = 340; // la boîte grandit jusque-là si elle est plus petite (peu de kiosques)
const COURBE = "cubic-bezier(.22,.8,.3,1)";

// Rectangle du texte lui-même (pas de sa boîte, qui occupe toute la largeur).
function rectTexte(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
}

// Liste des kiosques de la tablette : une carte par kiosque, dans une boîte. En toucher une : elle s'agrandit pour remplir toute la
// boîte (l'icône grossit au milieu, le texte passe dessous), puis « Chargement… » s'affiche tant que le kiosque n'est pas prêt.
// Pendant ce temps, on ne peut plus rien toucher.
// Le kiosque s'ouvre (router.push) dès le toucher, en arrière-plan : s'il est prêt avant la fin de l'animation, même en plein
// milieu, la liste disparaît et OuvertureKiosque reprend la carte exactement là où elle en était, la fait zoomer dans le kiosque.
// Avant de disparaître, la liste dépose donc une photo de sa carte (lib/transitionKiosque.js).
// kiosques : [{ id, nom, desc, image, icon }]
export default function ListeKiosques({ kiosques, t }) {
  const router = useRouter();
  const boite = useRef(null);
  const icones = useRef({}); // icône de chaque carte
  const textes = useRef({}); // texte de chaque carte
  const lignes = useRef({});
  const fin = useRef({}); // éléments de l'écran de chargement : icone, titre, desc
  const minuteurs = useRef([]);
  const [ouv, setOuv] = useState(null); // { k, href, depart, h0, h1, phase: "depart" | "plein", charge, lent }
  const ouvRef = useRef(null);
  ouvRef.current = ouv;

  useEffect(() => () => minuteurs.current.forEach(clearTimeout), []);

  // La page change (le kiosque est prêt) : on dépose la photo de la carte, telle qu'elle est à cet instant (voir OuvertureKiosque).
  useLayoutEffect(
    () => () => {
      const o = ouvRef.current;
      const b = boite.current;
      const e = fin.current;
      if (!o || !b || !e.icone || !e.titre || !e.desc || !e.charge) return;
      const rb = b.getBoundingClientRect();
      const geo = (el) => ({ l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, transform: getComputedStyle(el).transform });
      deposerInstantane({
        boite: { left: rb.left, top: rb.top, width: rb.width, height: rb.height },
        bordure: b.clientLeft,
        k: o.k,
        elements: { icone: geo(e.icone), titre: geo(e.titre), desc: geo(e.desc), charge: { ...geo(e.charge), opacite: Number(getComputedStyle(e.charge).opacity) } },
      });
    },
    []
  );

  function ouvrir(e, k, href) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; // lien normal, sans animation
    e.preventDefault();
    if (ouv) return;

    const b = boite.current;
    const rb = b.getBoundingClientRect();
    const ox = rb.left + b.clientLeft;
    const oy = rb.top + b.clientTop;
    const rel = (r) => ({ x: r.left - ox, y: r.top - oy, w: r.width, h: r.height });
    const bloc = textes.current[k.id];
    setOuv({
      k,
      href,
      depart: {
        icone: rel(icones.current[k.id].getBoundingClientRect()),
        titre: rel(rectTexte(bloc.querySelector(".admin-row-title"))),
        desc: rel(rectTexte(bloc.querySelector(".admin-row-sub"))),
      },
      h0: rb.height,
      h1: Math.max(rb.height, HAUTEUR_PLEIN_MIN),
      phase: "depart",
      charge: false,
      lent: false,
    });
    // On ouvre le kiosque tout de suite, en arrière-plan ; la carte reste à l'écran jusqu'à ce qu'il soit prêt.
    router.push(href);
    minuteurs.current.push(setTimeout(() => setOuv((o) => (o ? { ...o, lent: true } : o)), DELAI_LENT_MS));
  }

  // Étape 1 : l'écran de chargement apparaît, ses éléments posés exactement sur ceux de la carte (même position et même taille).
  useLayoutEffect(() => {
    if (!ouv || ouv.phase !== "depart") return;
    const b = boite.current;
    const rb = b.getBoundingClientRect();
    const ox = rb.left + b.clientLeft;
    const oy = rb.top + b.clientTop;
    for (const [cle, d] of [["icone", ouv.depart.icone], ["titre", ouv.depart.titre], ["desc", ouv.depart.desc]]) {
      const el = fin.current[cle];
      const f = el.getBoundingClientRect();
      el.style.transition = "none";
      el.style.transformOrigin = "0 0";
      el.style.transform = `translate(${d.x - (f.left - ox)}px, ${d.y - (f.top - oy)}px) scale(${d.w / f.width})`;
    }
    b.style.height = `${ouv.h0}px`;
    lignes.current[ouv.k.id].style.visibility = "hidden"; // la carte est remplacée, sur place, par l'écran de chargement
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOuv((o) => (o ? { ...o, phase: "plein" } : o))));
    return () => cancelAnimationFrame(id);
  }, [ouv?.phase === "depart"]);

  // Étape 2 : la boîte grandit, l'icône va au milieu et le texte passe dessous ; « Chargement… » apparaît à la fin.
  useEffect(() => {
    if (!ouv || ouv.phase !== "plein") return;
    for (const cle of ["icone", "titre", "desc"]) {
      const el = fin.current[cle];
      el.style.transition = `transform ${DUREE_EXPANSION_MS}ms ${COURBE}`;
      el.style.transform = "none";
    }
    boite.current.style.height = `${ouv.h1}px`;
    minuteurs.current.push(setTimeout(() => setOuv((o) => (o ? { ...o, charge: true } : o)), DUREE_EXPANSION_MS));
  }, [ouv?.phase === "plein"]);

  const visuel = (k, taille) =>
    k.image ? (
      <img src={k.image} alt="" width={taille} height={taille} style={{ flexShrink: 0, borderRadius: `${Math.round(taille / 5)}px`, display: "block" }} />
    ) : (
      <span style={{ fontSize: `${Math.round(taille * 0.62)}px`, flexShrink: 0, display: "block", lineHeight: 1 }}>{k.icon || <IconEcran className="gozly-icon" />}</span>
    );

  return (
    <div ref={boite} className={`admin-list kq-boite${ouv ? " ouvre" : ""}`}>
      {kiosques.map((k) => (
        <Link
          key={k.id}
          ref={(el) => (lignes.current[k.id] = el)}
          href={`/kiosque/${k.id}`}
          onClick={(e) => ouvrir(e, k, `/kiosque/${k.id}`)}
          className="admin-row"
          style={{ justifyContent: "flex-start", gap: "14px", textDecoration: "none", color: "inherit" }}
        >
          <span ref={(el) => (icones.current[k.id] = el)} style={{ display: "block", flexShrink: 0 }}>
            {visuel(k, 52)}
          </span>
          <div ref={(el) => (textes.current[k.id] = el)} className="admin-row-main" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div className="admin-row-title">{k.nom}</div>
            <div className="admin-row-sub">{k.desc}</div>
          </div>
        </Link>
      ))}

      {ouv && (
        <div className="kq-ouv" style={{ height: `${ouv.h1}px` }} aria-live="polite">
          <span ref={(el) => (fin.current.icone = el)} className="kq-ouv-icone">
            {visuel(ouv.k, 120)}
          </span>
          <div className="kq-ouv-textes">
            <div ref={(el) => (fin.current.titre = el)} className="kq-ouv-titre">
              {ouv.k.nom}
            </div>
            <div ref={(el) => (fin.current.desc = el)} className="kq-ouv-desc">
              {ouv.k.desc}
            </div>
          </div>
          <div ref={(el) => (fin.current.charge = el)} className={`kq-ouv-charge${ouv.charge ? " visible" : ""}`}>
            <span className="kq-spinner" aria-hidden="true" />
            <span>{t("kq.chargement")}</span>
          </div>
          {ouv.lent && (
            <div className="kq-ouv-lent">
              <span>{t("kq.lent")}</span>
              <button type="button" className="admin-icon-btn" onClick={() => router.push(ouv.href)}>
                {t("kq.reessayer")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
