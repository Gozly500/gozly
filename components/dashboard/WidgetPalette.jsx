"use client";
import { useT } from "@/components/LangProvider";

export default function WidgetPalette({ widgets, onDragStart }) {
  const { t } = useT();
  return (
    <aside className="widget-palette">
      <h4>{t("Widgets disponibles")}</h4>
      {widgets.length === 0 ? (
        <p className="widget-palette-empty">{t("Tout est déjà sur le tableau de bord.")}</p>
      ) : (
        widgets.map((w) => (
          <div
            key={w.id}
            className="widget-palette-tile"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", w.id);
              onDragStart(w.id);
            }}
          >
            {t(w.nom)}
          </div>
        ))
      )}
    </aside>
  );
}
