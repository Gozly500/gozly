"use client";

import { IconX } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

export default function WidgetCard({
  title,
  taille,
  editMode,
  onRemove,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}) {
  const { t } = useT();
  return (
    <div
      className={`widget-card${taille === "horizontal" ? " horizontal" : ""}${dragOver ? " drag-over" : ""}`}
      draggable={editMode}
      onDragStart={editMode ? onDragStart : undefined}
      onDragOver={editMode ? onDragOver : undefined}
      onDrop={editMode ? onDrop : undefined}
      onDragEnd={editMode ? onDragEnd : undefined}
    >
      <div className="widget-card-head">
        <h3>{title}</h3>
        {editMode && (
          <div className="widget-card-controls">
            <button type="button" className="widget-remove-btn" onClick={onRemove}>
              <IconX className="gozly-icon" />{" "}{t("Retirer")}
            </button>
            <span className="widget-drag-handle" title={t("Glisser pour réordonner")}>
              ⠿
            </span>
          </div>
        )}
      </div>

      {editMode ? <div style={{ pointerEvents: "none" }}>{children}</div> : children}
    </div>
  );
}
