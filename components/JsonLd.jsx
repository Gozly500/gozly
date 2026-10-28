// Données structurées (schema.org) lues par Google et les assistants IA pour comprendre ce que fait le site.
// Le « < » est échappé pour que le contenu ne puisse jamais fermer la balise <script>.
export default function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
