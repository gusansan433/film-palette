"use client";

/** Quiet gallery atmosphere. No click stamps, no geometry, no cursor follower. */
export function KandinskyField() {
  return (
    <div className="atmosphere" aria-hidden>
      <div className="atmosphere-wash" />
      <div className="atmosphere-stain atmosphere-stain-a" />
      <div className="atmosphere-stain atmosphere-stain-b" />
      <div className="atmosphere-stain atmosphere-stain-c" />
    </div>
  );
}
