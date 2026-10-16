"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/components/LangProvider";
import { AIDE, AIDE_UI } from "@/lib/aide";
import { LEGAL } from "@/lib/legal";

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
    <div className="aide-wrap">
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

      <div className="aide-contact">
        <p>
          <Link href="/statut">{ui.statut}</Link>
        </p>
        <strong>{ui.pasTrouve}</strong>
        <p>
          {ui.ecrire} <a href={`mailto:${LEGAL.courrielContact}`}>{LEGAL.courrielContact}</a>
          <br />
          <Link href="/contact">{ui.contact}</Link>
        </p>
      </div>
    </div>
  );
}
