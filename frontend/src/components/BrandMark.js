const BRAND_LOGO_SRC = `${process.env.PUBLIC_URL}/shareverse-logo.jpeg`;

export default function BrandMark({
  sizeClass = "h-9 w-9",
  roundedClass = "rounded-[12px]",
  className = "",
  imageClassName = "object-contain p-1.5",
}) {
  return (
    <span
      className={`inline-flex overflow-hidden border border-slate-200 bg-black ${sizeClass} ${roundedClass} ${className}`.trim()}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="ShareVerse logo"
        className={`h-full w-full ${imageClassName}`.trim()}
      />
    </span>
  );
}
