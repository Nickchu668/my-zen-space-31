import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Loader2, Plus, ExternalLink, Link2, Pencil, Trash2, Star, Instagram, Users, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InstagramAvatar } from '@/components/instagram/InstagramAvatar';

interface PageData {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string | null;
  content: string | null;
  allow_member_submit: boolean;
}

interface PageItem {
  id: string;
  page_id: string;
  title: string;
  content: string | null;
  url: string | null;
  category: string | null;
  sort_order: number;
  created_at: string;
  created_by: string | null;
  creator_name: string | null;
  is_starred: boolean;
  followers_count: string | null;
  avatar_url: string | null;
}

// Helper to check if URL is Instagram
const isInstagramUrl = (url: string | null): boolean => {
  if (!url) return false;
  return url.includes('instagram.com') || url.includes('instagr.am');
};

// Extract Instagram username from URL
const getInstagramUsername = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/instagram\.com\/([^/?]+)/);
  return match ? match[1] : null;
};

// Format follower count for display
const formatFollowers = (count: string | null): string => {
  if (!count) return '';
  
  // If already formatted (contains K, M, k, m), return as-is but normalize case
  const formattedMatch = count.match(/^([\d.,]+)\s*([KkMm])$/);
  if (formattedMatch) {
    const num = formattedMatch[1];
    const suffix = formattedMatch[2].toUpperCase();
    return `${num}${suffix}`;
  }
  
  // Try to parse as raw number
  const num = parseInt(count.replace(/,/g, ''), 10);
  if (isNaN(num)) return count;

   // For smaller accounts, show the exact number with separators for clarity.
   if (num < 10000) return num.toLocaleString('en-US');

  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, role, isAdmin } = useAuth();
  const [page, setPage] = useState<PageData | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PageItem | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', url: '', category: '一般', followers_count: '', avatar_url: '' });
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canAdd, setCanAdd] = useState(false);
  const [fetchingFollowers, setFetchingFollowers] = useState<string | null>(null);
  const [ocrFollowers, setOcrFollowers] = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const extractFollowersFromImage = async (item: PageItem, file: File) => {
    setOcrFollowers(item.id);
    try {
      const dataUrl = await readFileAsDataUrl(file);

      const { data, error } = await supabase.functions.invoke('extract-followers-from-image', {
        body: { imageBase64: dataUrl },
      });

      if (error) {
        toast.error('辨識失敗: ' + error.message);
        return;
      }

      if (!data?.success || !data?.followersCount) {
        toast.error(data?.error || '無法從截圖辨識追蹤者數量');
        return;
      }

      const raw = String(data.followersCount).trim();
      if (!/^\d+$/.test(raw)) {
        toast.error('辨識結果格式不正確');
        return;
      }

      const { error: updateError } = await supabase
        .from('page_items')
        .update({ followers_count: raw })
        .eq('id', item.id);

      if (updateError) throw updateError;

      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, followers_count: raw } : i)));
      toast.success(`已從截圖更新追蹤者: ${parseInt(raw, 10).toLocaleString('en-US')}`);
    } catch (e: any) {
      toast.error('辨識失敗: ' + (e?.message || '未知錯誤'));
    } finally {
      setOcrFollowers(null);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchPage(slug);
    }
  }, [slug]);

  useEffect(() => {
    if (page && user) {
      checkPermissions(page, user.id);
    }
  }, [page, user, isAdmin]);

  const checkPermissions = async (pageData: PageData, userId: string) => {
    // Admin can always edit and add
    if (isAdmin) {
      setCanEdit(true);
      setCanAdd(true);
      return;
    }

    // Check if user has edit permission via user_page_access
    const { data } = await supabase
      .from('user_page_access')
      .select('can_edit')
      .eq('user_id', userId)
      .eq('page_id', pageData.id)
      .maybeSingle();

    const hasEditPermission = data?.can_edit || false;
    setCanEdit(hasEditPermission);
    
    // Members can ONLY add on pages with allow_member_submit = true
    // Premium users with edit permission can add anywhere they have access
    // Regular members without edit permission can only add on member-submit pages
    if (hasEditPermission) {
      setCanAdd(true);
    } else {
      // Only allow adding on pages that explicitly allow member submissions
      setCanAdd(pageData.allow_member_submit === true);
    }
  };

  const fetchPage = async (pageSlug: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('pages')
      .select('*')
      .eq('slug', pageSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) {
      setError('無法載入頁面');
      setLoading(false);
      return;
    }
    
    if (!data) {
      setError('頁面不存在');
      setLoading(false);
      return;
    }

    setPage({
      ...data,
      content: typeof data.content === 'string' ? data.content : null,
      allow_member_submit: data.allow_member_submit || false,
    });

    // Fetch page items
    await fetchItems(data.id);
    setLoading(false);
  };

  const fetchItems = async (pageId: string) => {
    // Fetch page items
    const { data: itemsData, error } = await supabase
      .from('page_items')
      .select('*')
      .eq('page_id', pageId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching items:', error);
      return;
    }

    if (!itemsData || itemsData.length === 0) {
      setItems([]);
      return;
    }

    // Get unique creator IDs
    const creatorIds = [...new Set(itemsData.map(item => item.created_by).filter(Boolean))] as string[];
    
    // Fetch profiles for creators
    let profilesMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', creatorIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.user_id] = p.display_name || '';
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Map the data to include creator_name and followers_count
    const itemsWithCreator = itemsData.map((item) => ({
      ...item,
      creator_name: item.created_by ? profilesMap[item.created_by] || null : null,
      is_starred: item.is_starred || false,
      followers_count: item.followers_count || null,
      avatar_url: item.avatar_url || null,
    }));

    // Sort: starred items first, then by sort_order/created_at
    const sortedItems = itemsWithCreator.sort((a, b) => {
      if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
      return 0;
    });

    setItems(sortedItems);
  };

  const toggleStar = async (item: PageItem) => {
    try {
      const { error } = await supabase
        .from('page_items')
        .update({ is_starred: !item.is_starred })
        .eq('id', item.id);

      if (error) throw error;
      
      // Update local state
      setItems(prev => {
        const updated = prev.map(i => 
          i.id === item.id ? { ...i, is_starred: !i.is_starred } : i
        );
        // Re-sort with starred first
        return updated.sort((a, b) => {
          if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
          return 0;
        });
      });
      
      toast.success(item.is_starred ? '已取消星標' : '已加入星標');
    } catch (error: any) {
      toast.error('操作失敗: ' + error.message);
    }
  };

  const fetchInstagramFollowers = async (item: PageItem) => {
    if (!item.url || !isInstagramUrl(item.url)) return;
    
    setFetchingFollowers(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-instagram-data', {
        body: { url: item.url, itemId: item.id }
      });

      if (error) {
        toast.error('抓取失敗: ' + error.message);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || data?.message || '無法抓取追蹤者資料');
        return;
      }

      if (!data.followersCount) {
        toast.error(data?.message || '無法擷取追蹤者數量');
        return;
      }

      const raw = String(data.followersCount).trim();
      const looksLikeNumber = /^\d[\d,]*$/.test(raw);
      const looksLikeEstimateSuffix = /^([\d.,]+)\s*([KkMm])$/.test(raw);

      // If AI returned something like "11.1K", reject it
      if (looksLikeEstimateSuffix) {
        toast.error('抓取結果為估算值（如 11.1K），可能不準確。請改用手動輸入精確數字。');
        return;
      }

      // If not a numeric format at all, reject
      if (!looksLikeNumber) {
        toast.error('抓取到的追蹤者格式不正確，已避免自動覆蓋。');
        return;
      }

      const normalized = raw.replace(/,/g, '');
      const isEstimate = data.isEstimate === true;

      // Persist to DB (respects RLS; button only appears for editors/owners)
      const { error: updateError } = await supabase
        .from('page_items')
        .update({ followers_count: normalized })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // Update local state
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, followers_count: normalized } : i
      ));
      
      if (isEstimate) {
        toast.warning(`追蹤者數量: ${parseInt(normalized, 10).toLocaleString()}（透過 AI 搜尋，可能有誤差）`);
      } else {
        toast.success(`已獲取追蹤者數量: ${parseInt(normalized, 10).toLocaleString()}`);
      }
    } catch (error: any) {
      console.error('Error fetching Instagram data:', error);
      toast.error('抓取失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setFetchingFollowers(null);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !page) {
      toast.error('請輸入標題');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('page_items')
          .update({
            title: formData.title.trim(),
            content: formData.content.trim() || null,
            url: formData.url.trim() || null,
            category: formData.category.trim() || '一般',
            followers_count: formData.followers_count.trim() || null,
            avatar_url: formData.avatar_url.trim() || null,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('資料已更新');
      } else {
        const { error } = await supabase
          .from('page_items')
          .insert({
            page_id: page.id,
            title: formData.title.trim(),
            content: formData.content.trim() || null,
            url: formData.url.trim() || null,
            category: formData.category.trim() || '一般',
            followers_count: formData.followers_count.trim() || null,
            avatar_url: formData.avatar_url.trim() || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('資料已新增');
      }

      setIsDialogOpen(false);
      setEditingItem(null);
      setFormData({ title: '', content: '', url: '', category: '一般', followers_count: '', avatar_url: '' });
      await fetchItems(page.id);
    } catch (error: any) {
      toast.error('儲存失敗: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: PageItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      content: item.content || '',
      url: item.url || '',
      category: item.category || '一般',
      followers_count: item.followers_count || '',
      avatar_url: item.avatar_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這項資料嗎？') || !page) return;

    try {
      const { error } = await supabase.from('page_items').delete().eq('id', id);
      if (error) throw error;
      toast.success('資料已刪除');
      await fetchItems(page.id);
    } catch (error: any) {
      toast.error('刪除失敗: ' + error.message);
    }
  };

  const openDialog = () => {
    setEditingItem(null);
    setFormData({ title: '', content: '', url: '', category: '一般', followers_count: '', avatar_url: '' });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="page-container">
        <div className="max-w-6xl mx-auto text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{error || '頁面不存在'}</h2>
          <p className="text-muted-foreground">請確認頁面網址是否正確</p>
        </div>
      </div>
    );
  }

  // Get content as string
  const getContentHtml = (): string | null => {
    if (!page.content) return null;
    if (typeof page.content === 'string') return page.content;
    return null;
  };

  const contentHtml = getContentHtml();

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
              <FileText className="w-7 h-7 text-accent-foreground" />
            </div>
            <div>
              <h1 className="section-title mb-1">{page.title}</h1>
              {page.description && (
                <p className="text-muted-foreground">{page.description}</p>
              )}
            </div>
          </div>
          
          {canAdd && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openDialog} className="btn-fun gradient-primary text-primary-foreground gap-2">
                  <Plus className="w-4 h-4" />
                  新增資料
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingItem ? '編輯資料' : '新增資料'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">標題 *</label>
                    <Input
                      placeholder="輸入標題"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">內容</label>
                    <Textarea
                      placeholder="輸入內容描述"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">連結</label>
                    <Input
                      placeholder="https://..."
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">類別</label>
                    <Input
                      placeholder="一般"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  {isInstagramUrl(formData.url) && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1 block flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          頻道頭像 URL
                        </label>
                        <Input
                          placeholder="https://example.com/avatar.jpg"
                          value={formData.avatar_url}
                          onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">輸入圖片網址以自訂頻道頭像</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          追蹤者數量
                        </label>
                        <Input
                          placeholder="例如: 15000 或 1.5M"
                          value={formData.followers_count}
                          onChange={(e) => setFormData({ ...formData, followers_count: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  <Button onClick={handleSubmit} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingItem ? '更新' : '新增'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Rich Text Content */}
        {contentHtml && (
          <div 
            className="prose prose-gray dark:prose-invert max-w-none bg-card rounded-xl p-6 border border-border mb-8"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        )}

        {/* Items List */}
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:shadow-soft transition-all group"
              >
                {/* Star Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleStar(item)}
                  className="shrink-0"
                >
                  <Star className={cn(
                    "w-5 h-5 transition-colors",
                    item.is_starred ? "fill-star text-star-foreground" : "text-muted-foreground"
                  )} />
                </Button>

                {/* Icon - Manual avatar URL, Instagram auto-fetch, or generic icon */}
                {isInstagramUrl(item.url) ? (
                  item.avatar_url && !failedAvatars.has(item.id) ? (
                    <div className="w-12 h-12 rounded-full shrink-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                      <div className="w-full h-full rounded-full overflow-hidden bg-card">
                        <img
                          src={item.avatar_url}
                          alt={`${item.title} avatar`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            // Use React state to track failed avatars instead of DOM manipulation
                            setFailedAvatars(prev => new Set(prev).add(item.id));
                          }}
                        />
                      </div>
                    </div>
                  ) : failedAvatars.has(item.id) ? (
                    // Fallback to first letter when avatar fails
                    <div className="w-12 h-12 rounded-full shrink-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                      <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                        <span className="text-sm font-bold text-pink-500">{item.title[0]?.toUpperCase() || '?'}</span>
                      </div>
                    </div>
                  ) : (
                    <InstagramAvatar username={getInstagramUsername(item.url)} size="md" />
                  )
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    {item.url ? (
                      <Link2 className="w-5 h-5 text-primary" />
                    ) : (
                      <FileText className="w-5 h-5 text-primary" />
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isInstagramUrl(item.url) && (
                      <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                    )}
                    <h3 className="font-semibold truncate">{item.title}</h3>
                    {item.creator_name && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        by {item.creator_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.followers_count && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {formatFollowers(item.followers_count)} 追蹤者
                      </span>
                    )}
                    {item.content && !item.followers_count && (
                      <p className="text-sm text-muted-foreground truncate">{item.content}</p>
                    )}
                    {item.content && item.followers_count && (
                      <span className="text-muted-foreground">•</span>
                    )}
                    {item.content && item.followers_count && (
                      <p className="text-sm text-muted-foreground truncate">{item.content}</p>
                    )}
                  </div>
                </div>

                {/* Category */}
                <span className="px-2 py-1 rounded-lg bg-muted text-xs font-medium shrink-0 hidden sm:block">
                  {item.category || '一般'}
                </span>

                {/* Link */}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline shrink-0 hidden md:flex"
                  >
                    開啟
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {/* Actions - show if user can edit this item (is owner or has full edit permission) */}
                {(canEdit || (user && item.created_by === user.id)) && (
                  <div className="flex gap-1 shrink-0">
                    {/* Fetch Instagram followers button */}
                    {isInstagramUrl(item.url) && (
                      <>
                        <input
                          id={`ig-ocr-${item.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) extractFollowersFromImage(item, f);
                            // allow re-selecting same file
                            e.currentTarget.value = '';
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const el = document.getElementById(`ig-ocr-${item.id}`) as HTMLInputElement | null;
                            el?.click();
                          }}
                          disabled={ocrFollowers === item.id}
                          className="opacity-0 group-hover:opacity-100"
                          title="用截圖辨識追蹤者數量"
                        >
                          {ocrFollowers === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => fetchInstagramFollowers(item)}
                          disabled={fetchingFollowers === item.id}
                          className="opacity-0 group-hover:opacity-100"
                          title="抓取追蹤者數量"
                        >
                          {fetchingFollowers === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(item)}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-xl">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {contentHtml ? '尚無資料項目' : '此頁面尚無內容'}
            </p>
            {canAdd && !contentHtml && (
              <p className="text-sm text-muted-foreground mt-2">
                點擊上方「新增資料」開始添加內容
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
