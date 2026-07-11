/**
 * Subtle warm gradient backdrop — minimal, no canvas, no floating elements.
 * Just a soft ambient glow behind the project request page.
 */
export function ProjectRequestBackdrop() {
  return (
    <div className="project-backdrop" aria-hidden="true">
      {/* Core ambient glow — warm center, dark edges */}
      <div className="project-backdrop-glow" />

      {/* Floor wash */}
      <div className="project-backdrop-floor" />

      {/* Vignette — deepens corners */}
      <div className="project-backdrop-vignette" />
    </div>
  );
}
