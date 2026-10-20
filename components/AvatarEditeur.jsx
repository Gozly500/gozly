"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { COULEURS_CHAPEAU, COULEURS_CORPS, avatarAleatoire, avatarParDefaut, normaliserAvatar, pieceParId } from "@/lib/avatar";
import { PIECES } from "@/lib/avatarPieces";

const TEXTES = {
  fr: {
    onglets: { corps: "Couleur", yeux: "Yeux", bouche: "Bouche", chapeau: "Chapeau", lunettes: "Lunettes" },
    aleatoire: "Au hasard",
    aucun: "Aucun",
    aucune: "Aucune",
    couleurChapeau: "Couleur du chapeau",
    couleurCorps: "Couleur du corps",
    typeLunettes: "Type de lunettes",
    standard: "Standard",
    soleil: "De soleil",
    apercu: "Aperçu de ton avatar",
  },
  en: {
    onglets: { corps: "Color", yeux: "Eyes", bouche: "Mouth", chapeau: "Hat", lunettes: "Glasses" },
    aleatoire: "Randomize",
    aucun: "None",
    aucune: "None",
    couleurChapeau: "Hat color",
    couleurCorps: "Body color",
    typeLunettes: "Glasses type",
    standard: "Regular",
    soleil: "Sunglasses",
    apercu: "Your avatar preview",
  },
};

// Éditeur d'avatar : on choisit une pièce par couche et des couleurs ; `onChange` reçoit l'avatar à jour.
export default function AvatarEditeur({ valeur, onChange, nom = "", langue = "fr" }) {
  const T = TEXTES[langue] || TEXTES.fr;
  const a = normaliserAvatar(valeur) || avatarParDefaut(nom);
  const [onglet, setOnglet] = useState("corps");
  const maj = (patch) => onChange({ ...a, ...patch });
  const chapeau = a.chapeau ? pieceParId("chapeaux", a.chapeau) : null;

  const Tuile = ({ actif, onClick, titre, children }) => (
    <button type="button" className={`avatar-tuile${actif ? " actif" : ""}`} onClick={onClick} title={titre} aria-label={titre} aria-pressed={actif}>
      {children}
    </button>
  );

  const Pastilles = ({ couleurs, choisie, onChoix, titre }) => (
    <div className="avatar-pastilles" role="group" aria-label={titre}>
      {couleurs.map((c) => (
        <button key={c} type="button" className={`avatar-pastille${choisie === c ? " actif" : ""}`} style={{ background: c }} onClick={() => onChoix(c)} aria-label={c} aria-pressed={choisie === c} />
      ))}
    </div>
  );

  return (
    <div className="avatar-editeur">
      <div className="avatar-apercu">
        <div className="avatar-apercu-cadre" aria-label={T.apercu}>
          <Avatar valeur={a} nom={nom} taille={190} />
        </div>
        <button type="button" className="admin-icon-btn" onClick={() => onChange(avatarAleatoire())}>
          {T.aleatoire}
        </button>
      </div>

      <div className="avatar-choix">
        <div className="avatar-onglets" role="tablist">
          {Object.entries(T.onglets).map(([id, texte]) => (
            <button key={id} type="button" role="tab" aria-selected={onglet === id} className={`avatar-onglet${onglet === id ? " actif" : ""}`} onClick={() => setOnglet(id)}>
              {texte}
            </button>
          ))}
        </div>

        {onglet === "corps" && <Pastilles couleurs={COULEURS_CORPS} choisie={a.corps} onChoix={(c) => maj({ corps: c })} titre={T.couleurCorps} />}

        {onglet === "yeux" && (
          <div className="avatar-grille">
            {PIECES.yeux.map((p) => (
              <Tuile key={p.id} actif={a.yeux === p.id} onClick={() => maj({ yeux: p.id })} titre={p.label}>
                <Avatar valeur={{ ...a, yeux: p.id }} taille={64} />
              </Tuile>
            ))}
          </div>
        )}

        {onglet === "bouche" && (
          <div className="avatar-grille">
            {PIECES.bouche.map((p) => (
              <Tuile key={p.id} actif={a.bouche === p.id} onClick={() => maj({ bouche: p.id })} titre={p.label}>
                <Avatar valeur={{ ...a, bouche: p.id }} taille={64} />
              </Tuile>
            ))}
          </div>
        )}

        {onglet === "chapeau" && (
          <>
            <div className="avatar-grille">
              <Tuile actif={!a.chapeau} onClick={() => maj({ chapeau: null })} titre={T.aucun}>
                <Avatar valeur={{ ...a, chapeau: null }} taille={64} />
              </Tuile>
              {PIECES.chapeaux.map((p) => (
                <Tuile key={p.id} actif={a.chapeau === p.id} onClick={() => maj({ chapeau: p.id })} titre={p.label}>
                  <Avatar valeur={{ ...a, chapeau: p.id }} taille={64} />
                </Tuile>
              ))}
            </div>
            {chapeau?.couleur && (
              <div className="avatar-sous-choix">
                <span>{T.couleurChapeau}</span>
                <Pastilles couleurs={COULEURS_CHAPEAU} choisie={a.chapeauCouleur} onChoix={(c) => maj({ chapeauCouleur: c })} titre={T.couleurChapeau} />
              </div>
            )}
          </>
        )}

        {onglet === "lunettes" && (
          <>
            <div className="avatar-grille">
              <Tuile actif={!a.lunettes} onClick={() => maj({ lunettes: null })} titre={T.aucune}>
                <Avatar valeur={{ ...a, lunettes: null }} taille={64} />
              </Tuile>
              {PIECES.lunettes.map((p) => (
                <Tuile key={p.id} actif={a.lunettes === p.id} onClick={() => maj({ lunettes: p.id })} titre={p.label}>
                  <Avatar valeur={{ ...a, lunettes: p.id }} taille={64} />
                </Tuile>
              ))}
            </div>
            {a.lunettes && (
              <div className="avatar-sous-choix">
                <span>{T.typeLunettes}</span>
                <div className="avatar-segment" role="group" aria-label={T.typeLunettes}>
                  {["standard", "soleil"].map((type) => (
                    <button key={type} type="button" className={a.lunettesType === type ? "actif" : ""} aria-pressed={a.lunettesType === type} onClick={() => maj({ lunettesType: type })}>
                      {T[type]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
