import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Navbar } from "@/components/Navbar";
import { SocialBanner } from "@/components/SocialBanner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Post {
  id: string;
  title: string;
  thumbnail_url: string;
  slug: string;
  created_at: string;
}

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  image_url: string;
  display_order: number;
}

const POSTS_PER_PAGE = 12;

export default function Home() {
  const { page: pageParam } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  
  const page = parseInt(pageParam || "1", 10);

  useEffect(() => {
    fetchPosts();
    fetchSocialLinks();
  }, [page]);

  const fetchPosts = async () => {
    setLoading(true);
    
    // Get total count
    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    if (count) {
      setTotalPages(Math.ceil(count / POSTS_PER_PAGE));
    }

    // Get paginated posts
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE - 1);

    if (error) {
      console.error("Error fetching posts:", error);
    } else {
      setPosts(data || []);
    }

    setLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Social Media Banners - Horizontal Layout */}
        {socialLinks.length > 0 && (
          <div className="mb-8 px-4">
            <div className="flex flex-wrap justify-center gap-4">
              {socialLinks.map((link) => (
                <SocialBanner
                  key={link.id}
                  platform={link.platform}
                  url={link.url}
                  imageUrl={link.image_url}
                  layout="horizontal"
                />
              ))}
            </div>
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">
          Latest Videos
        </h1>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No posts yet. Check back soon!
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  id={post.id}
                  title={post.title}
                  thumbnailUrl={post.thumbnail_url}
                  slug={post.slug}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newPage = Math.max(1, page - 1);
                    navigate(newPage === 1 ? "/" : `/${newPage}`);
                  }}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2 px-4">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const newPage = Math.min(totalPages, page + 1);
                    navigate(newPage === 1 ? "/" : `/${newPage}`);
                  }}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
