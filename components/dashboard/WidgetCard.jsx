"use client";

export default function WidgetCard({
  title,
  editMode,
  visible,
  onToggleVisible,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}) {
  return (
    <div
      className={`widget-card${editMode && !visible ? " edit-hidden" : ""}${dragOver ? " drag-over" : ""}`}
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
            <button type="button" className={`widget-toggle-btn${visible ? " on" : ""}`} onClick={onToggleVisible}>
              {visible ? "👁 Visible" : "🚫 Masqué"}
            </button>
            <span className="widget-drag-handle" title="Glisser pour réordonner">
              ⠿
            </span>
          </div>
        )}
      </div>

      {(!editMode || visible) && children}
      {editMode && !visible && <p className="widget-card-empty">Masqué du tableau de bord.</p>}
    </div>
  );
}
