import { cn } from "@/lib/utils";

interface SocialBannerProps {
  platform: string;
  url: string;
  imageUrl: string;
  layout?: "horizontal" | "vertical";
  className?: string;
}

export function SocialBanner({ platform, url, imageUrl, layout = "horizontal", className }: SocialBannerProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative block rounded-md overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300",
        layout === "horizontal" ? "w-full max-w-[300px] mx-auto aspect-[3/1]" : "w-full aspect-[3/1]",
        className
      )}
    >
      <img
        src={imageUrl}
        className="object-cover w-full h-full"
        alt={`${platform} Banner`}
        loading="lazy"
      />
    </a>
  );
}
