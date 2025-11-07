import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { TeraBoxEmbed } from "@/components/TeraBoxEmbed";
import { SocialBanner } from "@/components/SocialBanner";
import { Loader2, ArrowLeft, Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface Post {
  id: string;
  title: string;
  thumbnail_url: string;
  video_links: string[];
  additional_images?: string[];
  slug: string;
}

interface SidebarPost {
  id: string;
  title: string;
  thumbnail_url: string;
  slug: string;
}

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  image_url: string;
  display_order: number;
}

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [post, setPost] = useState<Post | null>(null);
  const [sidebarPosts, setSidebarPosts] = useState<SidebarPost[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (slug) {
      fetchPost();
      fetchSidebarPosts();
      fetchSocialLinks();
    }
  }, [slug]);

  const fetchPost = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error fetching post:", error);
    } else {
      setPost({
        ...data,
        video_links: data.video_links as string[],
        additional_images: (data.additional_images as string[]) || []
      });
    }
    setLoading(false);
  };

  const fetchSidebarPosts = async () => {
    // Get total count of other posts
    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .neq("slug", slug);
    
    // Generate random offset to get different posts each time
    const randomOffset = count ? Math.floor(Math.random() * Math.max(0, count - 3)) : 0;
    
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, thumbnail_url, slug")
      .neq("slug", slug)
      .range(randomOffset, randomOffset + 2);

    if (error) {
      console.error("Error fetching sidebar posts:", error);
    } else {
      setSidebarPosts(data || []);
    }
  };

  const fetchSocialLinks = async () => {
    const { data, error } = await supabase
      .from("social_links")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching social links:", error);
    } else {
      setSocialLinks(data || []);
    }
  };

  const handleFullscreen = (index: number) => {
    const videoContainer = videoRefs.current[index];
    if (!videoContainer) return;

    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold mb-6">{post.title}</h1>

            {/* Featured Image with blur effect */}
            <div className="mb-6 rounded-lg overflow-hidden relative h-[400px] md:h-[500px] lg:h-[800px]">
              {/* Blurred background */}
              <img
                src={post.thumbnail_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
              />
              {/* Main image */}
              <img
                src={post.thumbnail_url}
                alt={post.title}
                className="relative w-full h-full object-contain z-10"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 overlay-gradient opacity-30 z-20" />
            </div>

            {/* Additional Images */}
            {post.additional_images && post.additional_images.length > 0 && (
              <div className="space-y-4 mb-6">
                {post.additional_images.map((imageUrl, index) => (
                  <div key={index} className="rounded-lg overflow-hidden relative h-[350px] md:h-[450px]">
                    {/* Blurred background */}
                    <img
                      src={imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
                    />
                    {/* Main image */}
                    <img
                      src={imageUrl}
                      alt={`${post.title} - Image ${index + 1}`}
                      className="relative w-full h-full object-contain z-10"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 overlay-gradient opacity-30 z-20" />
                  </div>
                ))}
              </div>
            )}

            {/* Video Links */}
            {post.video_links && post.video_links.length > 0 && (
              <div className="space-y-6">
                {post.video_links.map((link, index) => (
                  <TeraBoxEmbed 
                    key={index}
                    url={link}
                    title={`${post.title} - Video ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Must Watch */}
          <aside className="w-full lg:w-[350px] flex flex-col gap-4">
            {/* Social Media Banners - Vertical Layout */}
            {socialLinks.length > 0 && (
              <div className="space-y-4 mb-4">
                {socialLinks.map((link) => (
                  <SocialBanner
                    key={link.id}
                    platform={link.platform}
                    url={link.url}
                    imageUrl={link.image_url}
                    layout="vertical"
                  />
                ))}
              </div>
            )}

            <h3 className="text-xl font-bold mb-2">Must Watch</h3>

            {sidebarPosts.length > 0 ? (
              sidebarPosts.map((sidePost) => (
                <Link
                  key={sidePost.id}
                  to={`/post/${sidePost.slug}`}
                  className="group flex flex-col border border-border rounded-lg overflow-hidden hover:scale-[1.02] hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
                >
                  <div className="relative h-[280px] md:h-[550px] overflow-hidden">
                    {/* Blurred background */}
                    <img
                      src={sidePost.thumbnail_url}
                      className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
                      alt=""
                    />
                    {/* Main image */}
                    <img
                      src={sidePost.thumbnail_url}
                      className="relative w-full h-full object-contain z-10"
                      alt={sidePost.title}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 overlay-gradient opacity-0 group-hover:opacity-60 transition-opacity duration-300 z-20" />
                  </div>
                  <div className="p-3 bg-card">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{sidePost.title}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No more posts available</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
