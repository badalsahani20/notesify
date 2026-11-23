import notesifyLogo from "@/assets/notesify-favicon.svg";

interface AuthLogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

export default function AuthLogo({
  className = "",
  size = 46,
  alt = "Notesify",
}: AuthLogoProps) {
  return (
    <div className={`relative mb-3 flex items-center justify-center ${className}`}>
      <img
        src={notesifyLogo}
        alt={alt}
        width={size}
        height={size}
        className="object-contain select-none transition-transform duration-200 hover:scale-105"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </div>
  );
}
