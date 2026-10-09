import { notFound } from "next/navigation";
import { KIOSQUES } from "@/lib/kiosques";
import KiosqueEcran from "@/components/kiosque/KiosqueEcran";

export default function KiosqueEcranPage({ params }) {
  const kiosque = KIOSQUES.find((k) => k.id === params.id);
  if (!kiosque) notFound();
  return <KiosqueEcran id={kiosque.id} />;
}
