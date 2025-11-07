import { useEffect, useRef, useState } from "react";
import { Card } from "./ui/card";
import { ExternalLink } from "lucide-react";
import { Button } from "./ui/button";

interface TeraBoxEmbedProps {
  url: string;
  title?: string;
}

type VideoType = 'youtube' | 'terabox' | 'other';

export function TeraBoxEmbed({ url, title }: TeraBoxEmbedProps) {
  const [videoType, setVideoType] = useState<VideoType>('other');
  const [embedUrl, setEmbedUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Detect video type and create embed URL
    const detectAndCreateEmbed = () => {
      // YouTube patterns
      const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/i,
        /youtube\.com\/embed\/([^&\s]+)/i,
      ];

      // TeraBox patterns
      const teraboxPatterns = [
        /terabox\.com/i,
        /1024terabox\.com/i,
        /teraboxapp\.com/i,
        /4funbox\.com/i
      ];

      // Check for YouTube
      for (const pattern of youtubePatterns) {
        const match = url.match(pattern);
        if (match) {
          const videoId = match[1];
          setVideoType('youtube');
          setEmbedUrl(`https://www.youtube.com/embed/${videoId}`);
          return;
        }
      }

      // Check for TeraBox
      const isTeraBoxLink = teraboxPatterns.some(pattern => pattern.test(url));
      if (isTeraBoxLink) {
        setVideoType('terabox');
        try {
          const urlObj = new URL(url);
          const surl = urlObj.searchParams.get('surl');
          
          if (surl) {
            setEmbedUrl(`https://www.1024terabox.com/sharing/embed?surl=${encodeURIComponent(surl)}&autoplay=0`);
          } else {
            setEmbedUrl(url);
          }
        } catch (error) {
          console.error("Error parsing TeraBox URL:", error);
          setEmbedUrl(url);
        }
        return;
      }

      // Other video types
      setVideoType('other');
      setEmbedUrl(url);
    };

    detectAndCreateEmbed();
  }, [url]);

  // YouTube embed
  if (videoType === 'youtube') {
    return (
      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-black">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={title || "YouTube Video"}
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <div className="p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">YouTube Video</div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in YouTube
            </a>
          </Button>
        </div>
      </Card>
    );
  }

  // TeraBox embed
  if (videoType === 'terabox') {
    return (
      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-black">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={title || "TeraBox Video"}
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
        <div className="p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">TeraBox Video</div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in TeraBox
            </a>
          </Button>
        </div>
      </Card>
    );
  }

  // Other video link - try to embed or show link
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted flex items-center justify-center">
        <div className="text-center p-6">
          <ExternalLink className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            {title || "External Video Link"}
          </p>
          <Button asChild variant="default">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Open Video
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
