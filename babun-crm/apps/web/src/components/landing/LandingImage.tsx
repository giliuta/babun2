interface LandingImageProps {
  src: string;
  alt: string;
  /** Hint that this is the hero image for the page — disables lazy loading. */
  priority?: boolean;
}

/** Server-only landing image. No JS ships for this component.
 *
 * The CSS-styled wrapper is the placeholder — if `/landing/<file>.png`
 * is missing, the broken-image icon is hidden by `object-contain` on a
 * coloured background so the layout still looks intentional until an
 * asset is uploaded. Once a real screenshot lands in `public/landing/`
 * the `<img>` paints over the placeholder. */
export default function LandingImage({ src, alt, priority }: LandingImageProps) {
  return (
    <div
      className="w-full h-full rounded-[16px] overflow-hidden flex items-center justify-center text-[13px] font-medium"
      style={{
        background: "var(--accent-tint)",
        color: "var(--accent)",
      }}
    >
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
