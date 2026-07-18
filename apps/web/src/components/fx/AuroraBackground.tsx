export function AuroraBackground() {
  return (
    <div className="site-aurora" aria-hidden="true">
      <video
        className="site-aurora-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/backgrounds/humain-one-flow-poster.webp"
      >
        <source src="/backgrounds/humain-one-flow.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
