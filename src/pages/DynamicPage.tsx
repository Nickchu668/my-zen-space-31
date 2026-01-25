import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Loader2, Plus, ExternalLink, Link2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface PageData {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string | null;
  content: string | null;
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
}

export function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, role, isAdmin } = useAuth();
  const [page, setPage] = useState<PageData | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PageItem | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', url: '', category: '一般' });
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchPage(slug);
    }
  }, [slug]);

  useEffect(() => {
    if (page && user) {
      checkEditPermission(page, user.id);
    }
  }, [page, user, isAdmin]);

  const checkEditPermission = async (pageData: PageData, userId: string) => {
    // Admin can always edit
    if (isAdmin) {
      setCanEdit(true);
      return;
    }

    // Check if user has edit permission via user_page_access
    const { data } = await supabase
      .from('user_page_access')
      .select('can_edit')
      .eq('user_id', userId)
      .eq('page_id', pageData.id)
      .maybeSingle();

    setCanEdit(data?.can_edit || false);
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
    });

    // Fetch page items
    await fetchItems(data.id);
    setLoading(false);
  };

  const fetchItems = async (pageId: string) => {
    const { data, error } = await supabase
      .from('page_items')
      .select('*')
      .eq('page_id', pageId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching items:', error);
      return;
    }

    setItems(data || []);
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
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('資料已新增');
      }

      setIsDialogOpen(false);
      setEditingItem(null);
      setFormData({ title: '', content: '', url: '', category: '一般' });
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
    setFormData({ title: '', content: '', url: '', category: '一般' });
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
          
          {canEdit && (
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
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  {item.url ? (
                    <Link2 className="w-5 h-5 text-primary" />
                  ) : (
                    <FileText className="w-5 h-5 text-primary" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{item.title}</h3>
                  {item.content && (
                    <p className="text-sm text-muted-foreground truncate">{item.content}</p>
                  )}
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

                {/* Actions */}
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
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
            {canEdit && !contentHtml && (
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
