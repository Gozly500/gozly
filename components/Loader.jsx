"use client";

import { useEffect, useState } from "react";

export default function Loader() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHidden(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`loader${hidden ? " hidden" : ""}`}>
      <div className="loader-text">
        <span className="loader-dot"></span>Un moment...
      </div>
    </div>
  );
}
