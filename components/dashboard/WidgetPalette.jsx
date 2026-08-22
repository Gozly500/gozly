"use client";

export default function WidgetPalette({ widgets, onDragStart }) {
  return (
    <aside className="widget-palette">
      <h4>Widgets disponibles</h4>
      {widgets.length === 0 ? (
        <p className="widget-palette-empty">Tout est déjà sur le tableau de bord.</p>
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
            {w.nom}
          </div>
        ))
      )}
    </aside>
  );
}
