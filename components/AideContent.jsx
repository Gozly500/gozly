"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/components/LangProvider";
import { AIDE, AIDE_UI } from "@/lib/aide";
import { LEGAL } from "@/lib/legal";
import Gozyx from "@/components/Gozyx";

function normaliser(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function AideContent() {
  const { lang } = useT();
  const ui = AIDE_UI[lang] || AIDE_UI.fr;
  const categories = AIDE[lang] || AIDE.fr;
  const [recherche, setRecherche] = useState("");
  const [cat, setCat] = useState("toutes");

  const groupes = useMemo(() => {
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
    return categories
      .filter((c) => cat === "toutes" || c.id === cat)
      .map((c) => ({
        ...c,
        questions: c.questions.filter((q) => {
          if (!mots.length) return true;
          const texte = normaliser(q.q + " " + q.r.join(" "));
          return mots.every((m) => texte.includes(m));
        }),
      }))
      .filter((c) => c.questions.length > 0);
  }, [categories, recherche, cat]);

  return (
    <div className="aide-layout">
      {/* Colonne fixe (à gauche) : aide complémentaire, toujours visible pendant qu'on parcourt les questions. */}
      <aside className="aide-aside">
        <div className="aide-contact">
          <strong>{ui.pasTrouve}</strong>
          <Link href="/aide/tickets" className="aide-ticket-lien">
            {ui.ticket}
          </Link>
          <p>
            {ui.ecrire} <a href={`mailto:${LEGAL.courrielContact}`}>{LEGAL.courrielContact}</a>
            <br />
            <Link href="/contact">{ui.contact}</Link>
          </p>
          <hr />
          <p>
            <Link href="/statut">{ui.statut}</Link>
          </p>
        </div>
      </aside>

      <div className="aide-main">
      {/* Gozyx accueille et réagit à la recherche : content quand il trouve, inquiet quand il ne trouve rien. */}
      <div className="aide-gozyx">
        <Gozyx humeur={recherche.trim() ? (groupes.length ? "content" : "probleme") : "normal"} taille={84} />
        <div className="aide-bulle">{recherche.trim() ? (groupes.length ? ui.gozyxTrouve : ui.gozyxRien) : ui.gozyx}</div>
      </div>

      <div className="aide-recherche">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={ui.recherche}
          aria-label={ui.recherche}
        />
      </div>

      <div className="aide-chips" role="tablist">
        <button type="button" className={cat === "toutes" ? "actif" : ""} onClick={() => setCat("toutes")}>
          {ui.toutes}
        </button>
        {categories.map((c) => (
          <button key={c.id} type="button" className={cat === c.id ? "actif" : ""} onClick={() => setCat(c.id)}>
            {c.titre}
          </button>
        ))}
      </div>

      {groupes.length === 0 ? (
        <div className="aide-vide">
          <strong>{ui.aucun}</strong>
          <p>{ui.aucunAide}</p>
        </div>
      ) : (
        groupes.map((g) => (
          <section key={g.id} className="aide-carte">
            <h2>{g.titre}</h2>
            {g.questions.map((q) => (
              <details key={q.q} className="aide-q" open={recherche.trim() ? true : undefined}>
                <summary>{q.q}</summary>
                <div className="aide-r">
                  {q.r.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </details>
            ))}
          </section>
        ))
      )}

      </div>
    </div>
  );
}
