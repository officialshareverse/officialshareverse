const BRAND_LOGO_SRC = `${process.env.PUBLIC_URL}/shareverse-logo.jpeg`;

export default function BrandMark({
  sizeClass = "h-9 w-9",
  roundedClass = "rounded-2xl",
  className = "",
  imageClassName = "",
}) {
  return (
    <span
      className={`inline-flex overflow-hidden border border-slate-900/10 bg-black shadow-[0_10px_24px_rgba(15,23,42,0.14)] ${sizeClass} ${roundedClass} ${className}`}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="ShareVerse logo"
        className={`h-full w-full object-cover ${imageClassName}`}
      />
    </span>
  );
}
