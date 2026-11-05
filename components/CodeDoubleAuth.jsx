"use client";

import { useEffect, useRef } from "react";

// Champ du code à 6 chiffres de l'app d'authentification (clavier numérique, remplissage automatique du code reçu).
export default function CodeDoubleAuth({ value, onChange, disabled, autoFocus = true, id = "code-da" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <input
      ref={ref}
      id={id}
      className="da-code"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="000000"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}
