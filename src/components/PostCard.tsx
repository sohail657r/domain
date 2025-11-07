import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PostCardProps {
  id: string;
  title: string;
  thumbnailUrl: string;
  slug: string;
  className?: string;
}

export function PostCard({ id, title, thumbnailUrl, slug, className }: PostCardProps) {
  return (
    <Link
      to={`/post/${slug}`}
      className={cn(
        "group transform overflow-hidden cursor-pointer flex flex-col",
        "w-full h-[400px] md:h-[550px] lg:h-[800px]",
        "border border-border rounded-lg",
        "duration-200 transition-all",
        "hover:scale-105 hover:shadow-2xl hover:border-primary/50",
        "animate-fade-in",
        className
      )}
    >
      {/* Image container with blur background effect */}
      <div className="w-full h-full relative overflow-hidden rounded-t-lg">
        {/* Blurred background */}
        <img
          src={thumbnailUrl}
          className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
          alt=""
          loading="lazy"
        />
        {/* Main image */}
        <img
          src={thumbnailUrl}
          className="relative object-contain w-full h-full z-10"
          alt={title}
          loading="lazy"
        />
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 overlay-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />
      </div>

      {/* Title section */}
      <div className="mt-2 p-3 bg-card">
        <h3 className="text-sm md:text-base font-medium text-center line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
      </div>
    </Link>
  );
}
