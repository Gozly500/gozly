import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { LEGAL } from "@/lib/legal";

// Gabarit commun des pages légales : titre + sections { titre, contenu }.
// "contenu" est une liste de paragraphes (string) ou de listes à puces (string[]).
export default function LegalPage({ titre, intro, sections }) {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{titre}</h1>
          <p>Dernière mise à jour : {LEGAL.dateMiseAJour}</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <article className="legal-doc">
            {intro && <p>{intro}</p>}
            {sections.map((s, i) => (
              <div key={s.titre}>
                <h2>
                  {i + 1}. {s.titre}
                </h2>
                {s.contenu.map((bloc, j) =>
                  Array.isArray(bloc) ? (
                    <ul key={j}>
                      {bloc.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j}>{bloc}</p>
                  )
                )}
              </div>
            ))}
          </article>
        </div>
      </section>

      <Footer />
    </div>
  );
}
