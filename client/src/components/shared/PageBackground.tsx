interface PageBackgroundProps {
  image: string;
  opacity?: number;
}

export function PageBackground({ image, opacity = 0.15 }: PageBackgroundProps) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-[#0a0a0c]" />
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
      <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-[#00f3ff]/[0.03] rounded-full blur-[150px]" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-purple-600/[0.02] rounded-full blur-[120px]" />
    </div>
  );
}
