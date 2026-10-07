import { IconCrochet, IconX, IconHorloge, IconTelecharger, IconFlecheGauche, IconCloche, IconClocheBarree } from "@/components/icons/Pictogrammes";

// Textes traduits qui commencent par un émoji / symbole (« ✅ Approuvé », « ‹ Retour »...) : l'émoji est
// remplacé par le pictogramme correspondant de la bibliothèque, le reste du texte est inchangé.
const PICTOS = {
  "✅": IconCrochet,
  "❌": IconX,
  "⏳": IconHorloge,
  "📲": IconTelecharger,
  "‹": IconFlecheGauche,
  "🔔": IconCloche,
  "🔕": IconClocheBarree,
};
const MOTIF = new RegExp(`(${Object.keys(PICTOS).join("|")})`);

export default function Pictos({ texte }) {
  return (
    <>
      {String(texte ?? "")
        .split(MOTIF)
        .map((morceau, i) => {
          const Icone = PICTOS[morceau];
          return Icone ? <Icone key={i} className="gozly-icon" /> : morceau;
        })}
    </>
  );
}
