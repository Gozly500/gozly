"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";

export default function Loader() {
  const { t } = useT();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHidden(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`loader${hidden ? " hidden" : ""}`}>
      <div className="loader-text">
        <span className="loader-dot"></span>{t("loader.texte")}
      </div>
    </div>
  );
}
