import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FolderOpen, Plus, ExternalLink, Link2, FileText, Star, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Resource {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  category: string | null;
  is_starred: boolean | null;
  user_id: string;
  created_at: string;
}

export function ResourcesPage() {
  const { user, isAdmin, isPremium } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', url: '', category: '一般' });
  const [saving, setSaving] = useState(false);

  // Only admins and premium members can add/edit resources
  const canEdit = isAdmin || isPremium;

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('is_starred', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources(data || []);
    } catch (error: any) {
      toast.error('無法載入資料: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('請輸入標題');
      return;
    }

    setSaving(true);
    try {
      if (editingResource) {
        const { error } = await supabase
          .from('resources')
          .update({
            title: formData.title.trim(),
            content: formData.content.trim() || null,
            url: formData.url.trim() || null,
            category: formData.category.trim() || '一般',
          })
          .eq('id', editingResource.id);

        if (error) throw error;
        toast.success('資料已更新');
      } else {
        const { error } = await supabase
          .from('resources')
          .insert({
            title: formData.title.trim(),
            content: formData.content.trim() || null,
            url: formData.url.trim() || null,
            category: formData.category.trim() || '一般',
            user_id: user?.id,
          });

        if (error) throw error;
        toast.success('資料已新增');
      }

      setIsDialogOpen(false);
      setEditingResource(null);
      setFormData({ title: '', content: '', url: '', category: '一般' });
      fetchResources();
    } catch (error: any) {
      toast.error('儲存失敗: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      content: resource.content || '',
      url: resource.url || '',
      category: resource.category || '一般',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這項資料嗎？')) return;

    try {
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
      toast.success('資料已刪除');
      fetchResources();
    } catch (error: any) {
      toast.error('刪除失敗: ' + error.message);
    }
  };

  const toggleStar = async (resource: Resource) => {
    try {
      const { error } = await supabase
        .from('resources')
        .update({ is_starred: !resource.is_starred })
        .eq('id', resource.id);

      if (error) throw error;
      fetchResources();
    } catch (error: any) {
      toast.error('操作失敗: ' + error.message);
    }
  };

  const openDialog = () => {
    setEditingResource(null);
    setFormData({ title: '', content: '', url: '', category: '一般' });
    setIsDialogOpen(true);
  };

  const categories = [...new Set(resources.map(r => r.category || '一般'))];

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-accent-foreground" />
            </div>
            <div>
              <h1 className="section-title mb-1">有用資料</h1>
              <p className="text-muted-foreground">收藏和管理你的重要資料</p>
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
                  <DialogTitle>{editingResource ? '編輯資料' : '新增資料'}</DialogTitle>
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
                    {editingResource ? '更新' : '新增'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && resources.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">尚無資料</h3>
            <p className="text-muted-foreground mb-4">點擊上方按鈕新增你的第一筆資料</p>
          </div>
        )}

        {/* Resources list */}
        {!loading && resources.length > 0 && (
          <div className="space-y-3">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:shadow-soft transition-all group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  {resource.url ? (
                    <Link2 className="w-5 h-5 text-primary" />
                  ) : (
                    <FileText className="w-5 h-5 text-primary" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{resource.title}</h3>
                    {resource.is_starred && (
                      <Star className="w-4 h-4 text-yellow-500 fill-current shrink-0" />
                    )}
                  </div>
                  {resource.content && (
                    <p className="text-sm text-muted-foreground truncate">{resource.content}</p>
                  )}
                </div>

                {/* Category */}
                <span className="px-2 py-1 rounded-lg bg-muted text-xs font-medium shrink-0 hidden sm:block">
                  {resource.category || '一般'}
                </span>

                {/* Link */}
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline shrink-0 hidden md:flex"
                  >
                    開啟
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {/* Actions - only show for users with edit permission */}
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStar(resource)}
                      className={resource.is_starred ? 'text-yellow-500' : 'opacity-0 group-hover:opacity-100'}
                    >
                      <Star className={`w-4 h-4 ${resource.is_starred ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(resource)}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(resource.id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
