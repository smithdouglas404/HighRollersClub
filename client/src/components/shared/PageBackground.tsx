interface PageBackgroundProps {
  image: string;
  opacity?: number;
}

export function PageBackground({ image, opacity = 0.3 }: PageBackgroundProps) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.85) 50%, rgba(10,10,12,0.95) 100%)",
        }}
      />
    </div>
  );
}
