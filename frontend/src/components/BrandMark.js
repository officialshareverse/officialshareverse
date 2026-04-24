const BRAND_LOGO_SRC = `${process.env.PUBLIC_URL}/shareverse-logo.jpeg`;

export default function BrandMark({
  sizeClass = "h-9 w-9",
  roundedClass = "rounded-2xl",
  className = "",
  imageClassName = "object-contain p-1",
  glow = false,
}) {
  return (
    <span
      className={`inline-flex overflow-hidden border border-slate-900/10 bg-black shadow-[0_10px_24px_rgba(15,23,42,0.14)] transition duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-[0_16px_34px_rgba(15,23,42,0.18)] ${glow ? "sv-animate-glow ring-4 ring-white/35" : ""} ${sizeClass} ${roundedClass} ${className}`}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="ShareVerse logo"
        className={`h-full w-full ${imageClassName}`}
      />
    </span>
  );
}
