import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit, Link2, Upload, Users, Download, FileUp, ChevronUp, ChevronDown } from "lucide-react";
import { TeraBoxEmbed } from "@/components/TeraBoxEmbed";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { z } from "zod";

const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  video_links: z.array(z.string().url("Invalid video URL")).optional().default([]),
});

interface Post {
  id: string;
  title: string;
  thumbnail_url: string;
  video_links: string[];
  additional_images?: string[];
  slug: string;
}

interface SubAdmin {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  image_url: string;
  is_active: boolean;
  display_order: number;
}

type UserRole = 'admin' | 'subadmin' | null;

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [imageInputMethod, setImageInputMethod] = useState<'upload' | 'url'>('upload');
  const [importing, setImporting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const postsPerPage = 12;
  
  const [formData, setFormData] = useState({
    title: "",
    video_links: [] as string[],
    thumbnail_url: "",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  
  // Additional images (optional)
  const [additionalImages, setAdditionalImages] = useState<Array<{ file?: File; url?: string; preview: string }>>([]);
  
  // Sub-admin form
  const [newSubAdminEmail, setNewSubAdminEmail] = useState("");
  const [newSubAdminPassword, setNewSubAdminPassword] = useState("");
  const [creatingSubAdmin, setCreatingSubAdmin] = useState(false);

  // Social link form
  const [socialLinkForm, setSocialLinkForm] = useState({
    platform: "",
    url: "",
    image_url: "",
    display_order: 0,
  });
  const [socialLinkImageFile, setSocialLinkImageFile] = useState<File | null>(null);
  const [editingSocialLink, setEditingSocialLink] = useState<SocialLink | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.error("Please login first");
      navigate("/dasi");
      return;
    }

    // Check user role from user_roles table
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!roleData || (roleData.role !== 'admin' && roleData.role !== 'subadmin')) {
      toast.error("Access denied. Admin or Sub-Admin access required.");
      navigate("/");
      return;
    }

    setUserRole(roleData.role as UserRole);
    fetchPosts();
    
    if (roleData.role === 'admin') {
      fetchSubAdmins();
    }
    
    fetchSocialLinks();
  };

  const fetchPosts = async (page: number = currentPage) => {
    setLoading(true);
    
    // Get total count first
    const { count } = await supabase
      .from("posts")
      .select("*", { count: 'exact', head: true });
    
    setTotalPosts(count || 0);
    
    // Fetch paginated posts
    const from = (page - 1) * postsPerPage;
    const to = from + postsPerPage - 1;
    
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      toast.error("Error fetching posts");
    } else {
      setPosts((data || []).map(post => ({
        ...post,
        video_links: post.video_links as string[],
        additional_images: (post.additional_images as string[]) || []
      })));
    }
    setLoading(false);
  };

  const fetchSubAdmins = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('list-subadmins');
      if (error) throw error;
      setSubAdmins(data.subAdmins || []);
    } catch (error) {
      console.error("Error fetching sub-admins:", error);
    }
  };

  const fetchSocialLinks = async () => {
    const { data, error } = await supabase
      .from("social_links")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching social links:", error);
    } else {
      setSocialLinks(data || []);
    }
  };

  const handleAddVideoLink = () => {
    setFormData({
      ...formData,
      video_links: [...formData.video_links, ""],
    });
  };

  const handleRemoveVideoLink = (index: number) => {
    const newLinks = formData.video_links.filter((_, i) => i !== index);
    setFormData({ ...formData, video_links: newLinks });
  };

  const handleVideoLinkChange = (index: number, value: string) => {
    const newLinks = [...formData.video_links];
    newLinks[index] = value;
    setFormData({ ...formData, video_links: newLinks });
  };

  const handleMoveVideoUp = (index: number) => {
    if (index === 0) return;
    const newLinks = [...formData.video_links];
    [newLinks[index - 1], newLinks[index]] = [newLinks[index], newLinks[index - 1]];
    setFormData({ ...formData, video_links: newLinks });
  };

  const handleMoveVideoDown = (index: number) => {
    if (index === formData.video_links.length - 1) return;
    const newLinks = [...formData.video_links];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    setFormData({ ...formData, video_links: newLinks });
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailUrlChange = (url: string) => {
    setFormData({ ...formData, thumbnail_url: url });
    setThumbnailPreview(url);
    setThumbnailFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Filter out empty video links
      const filteredVideoLinks = formData.video_links.filter(link => link.trim() !== "").map(link => link.trim());
      
      // Validate form data
      const validatedData = postSchema.parse({
        title: formData.title.trim(),
        video_links: filteredVideoLinks,
      });

      // Check if thumbnail is provided
      if (!editingPost && !thumbnailFile && !formData.thumbnail_url.trim()) {
        toast.error("Please provide a thumbnail image (upload or URL)");
        setSubmitting(false);
        return;
      }

      let thumbnailUrl = editingPost?.thumbnail_url || formData.thumbnail_url;

      // Upload thumbnail if new file is selected
      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-thumbnails')
          .upload(filePath, thumbnailFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          toast.error("Failed to upload thumbnail");
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('post-thumbnails')
          .getPublicUrl(filePath);

        thumbnailUrl = publicUrl;
      }

      // Upload additional images
      const additionalImageUrls: string[] = [];
      for (const img of additionalImages) {
        if (img.file) {
          // Upload file
          const fileExt = img.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('post-thumbnails')
            .upload(filePath, img.file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error("Failed to upload additional image:", uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('post-thumbnails')
            .getPublicUrl(filePath);

          additionalImageUrls.push(publicUrl);
        } else if (img.url) {
          // Use URL directly
          additionalImageUrls.push(img.url);
        }
      }

      if (editingPost) {
        const { error } = await supabase
          .from("posts")
          .update({
            title: validatedData.title,
            thumbnail_url: thumbnailUrl,
            video_links: validatedData.video_links,
            additional_images: additionalImageUrls,
          })
          .eq("id", editingPost.id);

        if (error) throw error;
        toast.success("Post updated successfully!");
      } else {
        const { error } = await supabase
          .from("posts")
          .insert({
            title: validatedData.title,
            thumbnail_url: thumbnailUrl,
            video_links: validatedData.video_links,
            additional_images: additionalImageUrls,
            slug: "",
          });

        if (error) throw error;
        toast.success("Post created successfully!");
      }

      setFormData({ title: "", video_links: [""], thumbnail_url: "" });
      setThumbnailFile(null);
      setThumbnailPreview("");
      setAdditionalImages([]);
      setEditingPost(null);
      setCurrentPage(1); // Reset to first page after creating/editing
      fetchPosts(1);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to save post");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      video_links: post.video_links,
      thumbnail_url: post.thumbnail_url,
    });
    setThumbnailPreview(post.thumbnail_url);
    setThumbnailFile(null);
    // Load existing additional images
    if (post.additional_images && post.additional_images.length > 0) {
      setAdditionalImages(post.additional_images.map(url => ({ url, preview: url })));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    const { error } = await supabase.from("posts").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete post");
    } else {
      toast.success("Post deleted successfully!");
      // If current page becomes empty after delete, go to previous page
      const newTotal = totalPosts - 1;
      const totalPages = Math.ceil(newTotal / postsPerPage);
      const newPage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);
      fetchPosts(newPage);
    }
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setFormData({ title: "", video_links: [""], thumbnail_url: "" });
    setThumbnailFile(null);
    setThumbnailPreview("");
    setAdditionalImages([]);
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSubAdmin(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-subadmin', {
        body: { email: newSubAdminEmail, password: newSubAdminPassword }
      });

      if (error) throw error;

      toast.success("Sub-admin created successfully!");
      setNewSubAdminEmail("");
      setNewSubAdminPassword("");
      fetchSubAdmins();
    } catch (error: any) {
      toast.error(error.message || "Failed to create sub-admin");
    } finally {
      setCreatingSubAdmin(false);
    }
  };

  const handleDeleteSubAdmin = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this sub-admin?")) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "subadmin");

      if (error) throw error;

      toast.success("Sub-admin removed successfully");
      fetchSubAdmins();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove sub-admin");
    }
  };

  // Social Links CRUD operations
  const handleSocialLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let imageUrl = socialLinkForm.image_url;

      // Upload image if file is selected
      if (socialLinkImageFile) {
        const fileExt = socialLinkImageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('post-thumbnails')
          .upload(fileName, socialLinkImageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-thumbnails')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      if (!imageUrl) {
        toast.error("Please provide an image");
        setSubmitting(false);
        return;
      }

      if (editingSocialLink) {
        // Update existing link
        const { error } = await supabase
          .from("social_links")
          .update({
            platform: socialLinkForm.platform,
            url: socialLinkForm.url,
            image_url: imageUrl,
            display_order: socialLinkForm.display_order,
          })
          .eq("id", editingSocialLink.id);

        if (error) throw error;
        toast.success("Social link updated successfully!");
        setEditingSocialLink(null);
      } else {
        // Create new link
        const { error } = await supabase
          .from("social_links")
          .insert({
            platform: socialLinkForm.platform,
            url: socialLinkForm.url,
            image_url: imageUrl,
            display_order: socialLinkForm.display_order,
          });

        if (error) throw error;
        toast.success("Social link created successfully!");
      }

      setSocialLinkForm({
        platform: "",
        url: "",
        image_url: "",
        display_order: 0,
      });
      setSocialLinkImageFile(null);
      fetchSocialLinks();
    } catch (error: any) {
      toast.error(error.message || "Failed to save social link");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSocialLink = (link: SocialLink) => {
    setEditingSocialLink(link);
    setSocialLinkForm({
      platform: link.platform,
      url: link.url,
      image_url: link.image_url,
      display_order: link.display_order,
    });
  };

  const handleDeleteSocialLink = async (id: string) => {
    if (!confirm("Are you sure you want to delete this social link?")) return;

    try {
      const { error } = await supabase
        .from("social_links")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Social link deleted successfully!");
      fetchSocialLinks();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete social link");
    }
  };

  const handleToggleSocialLink = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("social_links")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Social link ${!isActive ? 'activated' : 'deactivated'} successfully!`);
      fetchSocialLinks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update social link");
    }
  };

  const handleExportBackup = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const backup = {
        version: "1.0",
        exported_at: new Date().toISOString(),
        posts: data
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `posts-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup exported successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to export backup");
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.posts || !Array.isArray(backup.posts)) {
        throw new Error("Invalid backup file format");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Import posts
      const postsToInsert = backup.posts.map((post: any) => ({
        title: post.title,
        thumbnail_url: post.thumbnail_url,
        video_links: post.video_links,
        additional_images: post.additional_images || [],
        slug: "", // Will be auto-generated
      }));

      const { error } = await supabase
        .from("posts")
        .insert(postsToInsert);

      if (error) throw error;

      toast.success(`Successfully imported ${postsToInsert.length} posts!`);
      setCurrentPage(1);
      fetchPosts(1);
    } catch (error: any) {
      toast.error(error.message || "Failed to import backup");
    } finally {
      setImporting(false);
      e.target.value = ""; // Reset file input
    }
  };

  if (!userRole) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            Role: <span className="font-medium capitalize">{userRole}</span>
          </div>
        </div>

        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className={userRole === 'admin' ? "grid w-full max-w-2xl grid-cols-3" : "grid w-full max-w-md"}>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            {userRole === 'admin' && (
              <>
                <TabsTrigger value="social">
                  <Link2 className="h-4 w-4 mr-2" />
                  Social Links
                </TabsTrigger>
                <TabsTrigger value="subadmins">
                  <Users className="h-4 w-4 mr-2" />
                  Sub-Admins
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-6">
            {/* Backup/Restore Section (Admin Only) */}
            {userRole === 'admin' && (
              <Card>
                <CardHeader>
                  <CardTitle>Backup & Restore</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Button onClick={handleExportBackup} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Backup
                    </Button>
                    <Button 
                      variant="outline" 
                      disabled={importing}
                      onClick={() => document.getElementById('backup-import')?.click()}
                    >
                      {importing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileUp className="h-4 w-4 mr-2" />
                      )}
                      Import Backup
                    </Button>
                    <input
                      id="backup-import"
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Export all posts to a backup file or restore from a previous backup
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Add/Edit Post Form */}
            <Card>
              <CardHeader>
                <CardTitle>{editingPost ? "Edit Post" : "Add New Post"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Post Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter post title"
                      required
                      maxLength={200}
                    />
                  </div>

                  {/* Image Upload/URL Section */}
                  <div className="space-y-4">
                    <Label>Thumbnail Image</Label>
                    
                    <div className="flex gap-2 mb-3">
                      <Button
                        type="button"
                        variant={imageInputMethod === 'upload' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setImageInputMethod('upload')}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File
                      </Button>
                      <Button
                        type="button"
                        variant={imageInputMethod === 'url' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setImageInputMethod('url')}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Paste URL
                      </Button>
                    </div>

                    {imageInputMethod === 'upload' ? (
                      <div className="space-y-2">
                        <Input
                          id="thumbnail"
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground">
                          Max size: 5MB. Supported: JPG, PNG, WebP, GIF
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          type="url"
                          value={formData.thumbnail_url}
                          onChange={(e) => handleThumbnailUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground">
                          Paste a direct image URL
                        </p>
                      </div>
                    )}

                    {thumbnailPreview && (
                      <div className="mt-3 border rounded-lg overflow-hidden">
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Additional Images (Optional) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Additional Images (Optional)</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAdditionalImages([...additionalImages, { preview: "" }])}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Image
                      </Button>
                    </div>
                    
                    {additionalImages.length > 0 && (
                      <div className="space-y-3">
                        {additionalImages.map((img, index) => (
                          <div key={index} className="p-3 border rounded-lg space-y-2">
                            <div className="flex gap-2 items-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      if (!file.type.startsWith('image/')) {
                                        toast.error("Please select an image file");
                                        return;
                                      }
                                      if (file.size > 5 * 1024 * 1024) {
                                        toast.error("Image must be less than 5MB");
                                        return;
                                      }
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        const newImages = [...additionalImages];
                                        newImages[index] = { file, preview: reader.result as string };
                                        setAdditionalImages(newImages);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <Upload className="h-4 w-4 mr-1" />
                                Upload
                              </Button>
                              <Input
                                type="url"
                                placeholder="Or paste image URL"
                                value={img.url || ""}
                                onChange={(e) => {
                                  const newImages = [...additionalImages];
                                  newImages[index] = { url: e.target.value, preview: e.target.value };
                                  setAdditionalImages(newImages);
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setAdditionalImages(additionalImages.filter((_, i) => i !== index));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {img.preview && (
                              <div className="border rounded overflow-hidden">
                                <img src={img.preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Video Links (YouTube, TeraBox, etc.)</Label>
                      <Button type="button" size="sm" onClick={handleAddVideoLink} variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Video Link
                      </Button>
                    </div>
                    
                    {formData.video_links.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                        No video links added. Click "Add Video Link" to include YouTube, TeraBox, or other video links.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {formData.video_links.map((link, index) => (
                          <div key={index} className="space-y-2 p-3 border rounded-lg">
                            <div className="flex gap-2">
                              <div className="flex flex-col gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleMoveVideoUp(index)}
                                  disabled={index === 0}
                                  className="h-8 w-8"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleMoveVideoDown(index)}
                                  disabled={index === formData.video_links.length - 1}
                                  className="h-8 w-8"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                              <Input
                                type="url"
                                value={link}
                                onChange={(e) => handleVideoLinkChange(index, e.target.value)}
                                placeholder="https://youtube.com/watch?v=... or https://www.1024terabox.com/..."
                                maxLength={500}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                onClick={() => handleRemoveVideoLink(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {/* Video Preview */}
                            {link.trim() && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                                <TeraBoxEmbed 
                                  url={link}
                                  title={`Video ${index + 1}`}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting} className="flex-1">
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingPost ? "Update Post" : "Create Post"}
                    </Button>
                    {editingPost && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Posts List */}
            <Card>
              <CardHeader>
                <CardTitle>All Posts ({totalPosts})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : posts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No posts yet</p>
                ) : (
                  <>
                    <div className="space-y-4">
                      {posts.map((post) => (
                      <div
                        key={post.id}
                        className="flex items-center gap-4 p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <img
                          src={post.thumbnail_url}
                          alt={post.title}
                          className="w-24 h-16 object-cover rounded"
                        />
                          <div className="flex-1">
                            <h3 className="font-semibold">{post.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {post.video_links.length > 0 
                                ? `${post.video_links.length} video${post.video_links.length !== 1 ? "s" : ""}`
                                : "No videos"}
                            </p>
                          </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(post)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {userRole === 'admin' && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(post.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {totalPosts > postsPerPage && (
                    <div className="mt-6 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => {
                                if (currentPage > 1) {
                                  const newPage = currentPage - 1;
                                  setCurrentPage(newPage);
                                  fetchPosts(newPage);
                                }
                              }}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          
                          {Array.from({ length: Math.ceil(totalPosts / postsPerPage) }, (_, i) => i + 1).map((page) => {
                            const totalPages = Math.ceil(totalPosts / postsPerPage);
                            // Show first page, last page, current page, and pages around current
                            if (
                              page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 && page <= currentPage + 1)
                            ) {
                              return (
                                <PaginationItem key={page}>
                                  <PaginationLink
                                    onClick={() => {
                                      setCurrentPage(page);
                                      fetchPosts(page);
                                    }}
                                    isActive={currentPage === page}
                                    className="cursor-pointer"
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            } else if (
                              page === currentPage - 2 ||
                              page === currentPage + 2
                            ) {
                              return (
                                <PaginationItem key={page}>
                                  <span className="px-4">...</span>
                                </PaginationItem>
                              );
                            }
                            return null;
                          })}
                          
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => {
                                const totalPages = Math.ceil(totalPosts / postsPerPage);
                                if (currentPage < totalPages) {
                                  const newPage = currentPage + 1;
                                  setCurrentPage(newPage);
                                  fetchPosts(newPage);
                                }
                              }}
                              className={currentPage >= Math.ceil(totalPosts / postsPerPage) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sub-Admins Tab (Admin Only) */}
          {userRole === 'admin' && (
            <TabsContent value="subadmins" className="space-y-6">
              {/* Create Sub-Admin Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Create New Sub-Admin</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateSubAdmin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subadmin-email">Email</Label>
                      <Input
                        id="subadmin-email"
                        type="email"
                        value={newSubAdminEmail}
                        onChange={(e) => setNewSubAdminEmail(e.target.value)}
                        placeholder="subadmin@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subadmin-password">Password</Label>
                      <Input
                        id="subadmin-password"
                        type="password"
                        value={newSubAdminPassword}
                        onChange={(e) => setNewSubAdminPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        required
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" disabled={creatingSubAdmin}>
                      {creatingSubAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Sub-Admin
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Sub-Admins List */}
              <Card>
                <CardHeader>
                  <CardTitle>Sub-Admins ({subAdmins.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {subAdmins.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No sub-admins yet</p>
                  ) : (
                    <div className="space-y-3">
                      {subAdmins.map((subAdmin) => (
                        <div
                          key={subAdmin.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{subAdmin.email}</p>
                            <p className="text-sm text-muted-foreground">
                              Created: {new Date(subAdmin.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSubAdmin(subAdmin.user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Social Links Tab */}
          <TabsContent value="social" className="space-y-6">
            {/* Add/Edit Social Link Form */}
            <Card>
              <CardHeader>
                <CardTitle>{editingSocialLink ? "Edit Social Link" : "Add Social Link"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSocialLinkSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform Name</Label>
                    <Input
                      id="platform"
                      value={socialLinkForm.platform}
                      onChange={(e) => setSocialLinkForm({ ...socialLinkForm, platform: e.target.value })}
                      placeholder="e.g., Telegram, WhatsApp, Instagram"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="social-url">URL</Label>
                    <Input
                      id="social-url"
                      type="url"
                      value={socialLinkForm.url}
                      onChange={(e) => setSocialLinkForm({ ...socialLinkForm, url: e.target.value })}
                      placeholder="https://t.me/yourgroup"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Banner Image</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={imageInputMethod === 'upload' ? 'default' : 'outline'}
                        onClick={() => setImageInputMethod('upload')}
                        size="sm"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                      <Button
                        type="button"
                        variant={imageInputMethod === 'url' ? 'default' : 'outline'}
                        onClick={() => setImageInputMethod('url')}
                        size="sm"
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        URL
                      </Button>
                    </div>

                    {imageInputMethod === 'upload' ? (
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSocialLinkImageFile(e.target.files?.[0] || null)}
                      />
                    ) : (
                      <Input
                        type="url"
                        value={socialLinkForm.image_url}
                        onChange={(e) => setSocialLinkForm({ ...socialLinkForm, image_url: e.target.value })}
                        placeholder="https://example.com/banner.jpg"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display-order">Display Order</Label>
                    <Input
                      id="display-order"
                      type="number"
                      value={socialLinkForm.display_order}
                      onChange={(e) => setSocialLinkForm({ ...socialLinkForm, display_order: parseInt(e.target.value) })}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingSocialLink ? "Update" : "Create"} Social Link
                    </Button>
                    {editingSocialLink && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingSocialLink(null);
                          setSocialLinkForm({ platform: "", url: "", image_url: "", display_order: 0 });
                          setSocialLinkImageFile(null);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Social Links List */}
            <Card>
              <CardHeader>
                <CardTitle>Social Links ({socialLinks.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {socialLinks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No social links yet</p>
                ) : (
                  <div className="space-y-3">
                    {socialLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={link.image_url}
                            alt={link.platform}
                            className="w-20 h-10 object-cover rounded"
                          />
                          <div>
                            <p className="font-medium">{link.platform}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{link.url}</p>
                            <p className="text-xs text-muted-foreground">Order: {link.display_order}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={link.is_active ? "default" : "outline"}
                            onClick={() => handleToggleSocialLink(link.id, link.is_active)}
                          >
                            {link.is_active ? "Active" : "Inactive"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditSocialLink(link)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSocialLink(link.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
