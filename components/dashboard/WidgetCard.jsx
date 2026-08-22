"use client";

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
              ✕ Retirer
            </button>
            <span className="widget-drag-handle" title="Glisser pour réordonner">
              ⠿
            </span>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
