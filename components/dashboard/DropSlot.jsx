"use client";

export default function DropSlot({ dragOver, onDragOver, onDrop }) {
  return <div className={`widget-drop-slot${dragOver ? " drag-over" : ""}`} onDragOver={onDragOver} onDrop={onDrop} />;
}
