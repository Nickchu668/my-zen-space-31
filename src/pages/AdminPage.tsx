import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Users, 
  FileText, 
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Shield,
  Crown,
  User
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface UserWithRole {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

interface Page {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string | null;
  is_active: boolean;
  min_role: string;
  sort_order: number;
}

export function AdminPage() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [newPage, setNewPage] = useState({ title: '', slug: '', icon: 'file-text', description: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchPages();
  }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, email, display_name, created_at');

    if (profiles) {
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id)
            .maybeSingle();

          return {
            id: profile.user_id,
            email: profile.email,
            display_name: profile.display_name,
            role: roleData?.role || 'member',
            created_at: profile.created_at,
          };
        })
      );
      setUsers(usersWithRoles);
    }
  };

  const fetchPages = async () => {
    const { data } = await supabase
      .from('pages')
      .select('*')
      .order('sort_order');
    
    if (data) setPages(data);
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'premium' | 'member') => {
    // Delete existing role
    await supabase.from('user_roles').delete().eq('user_id', userId);
    
    // Insert new role
    const { error } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: newRole,
    });

    if (error) {
      toast({ title: '更新失敗', variant: 'destructive' });
    } else {
      toast({ title: '角色已更新' });
      fetchUsers();
    }
  };

  const createPage = async () => {
    if (!newPage.title || !newPage.slug) {
      toast({ title: '請填寫標題和路徑', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('pages').insert({
      title: newPage.title,
      slug: newPage.slug,
      icon: newPage.icon,
      description: newPage.description,
      sort_order: pages.length,
    });

    if (error) {
      toast({ title: '創建失敗', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '頁面已創建' });
      setNewPage({ title: '', slug: '', icon: 'file-text', description: '' });
      setIsCreatingPage(false);
      fetchPages();
    }
  };

  const updatePage = async (page: Page) => {
    const { error } = await supabase
      .from('pages')
      .update({
        title: page.title,
        slug: page.slug,
        icon: page.icon,
        description: page.description,
        is_active: page.is_active,
        min_role: page.min_role as 'admin' | 'premium' | 'member',
      })
      .eq('id', page.id);

    if (error) {
      toast({ title: '更新失敗', variant: 'destructive' });
    } else {
      toast({ title: '頁面已更新' });
      setEditingPage(null);
      fetchPages();
    }
  };

  const deletePage = async (id: string) => {
    const { error } = await supabase.from('pages').delete().eq('id', id);

    if (error) {
      toast({ title: '刪除失敗', variant: 'destructive' });
    } else {
      toast({ title: '頁面已刪除' });
      fetchPages();
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'premium': return <Crown className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-admin';
      case 'premium': return 'badge-premium';
      default: return 'badge-member';
    }
  };

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
            <Settings className="w-7 h-7 text-accent-foreground" />
          </div>
          <div>
            <h1 className="section-title mb-1">管理設定</h1>
            <p className="text-muted-foreground">管理用戶和頁面設置</p>
          </div>
        </div>

        {/* Users Management */}
        <Card className="card-fun mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              用戶管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用戶</TableHead>
                  <TableHead>電郵</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>加入日期</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.display_name || user.email.split('@')[0]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeClass(user.role)}>
                        {getRoleIcon(user.role)}
                        <span className="ml-1">
                          {user.role === 'admin' ? '管理員' : user.role === 'premium' ? '高級會員' : '會員'}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('zh-TW')}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateUserRole(user.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">管理員</SelectItem>
                          <SelectItem value="premium">高級會員</SelectItem>
                          <SelectItem value="member">會員</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pages Management */}
        <Card className="card-fun">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              頁面管理
            </CardTitle>
            <Dialog open={isCreatingPage} onOpenChange={setIsCreatingPage}>
              <DialogTrigger asChild>
                <Button className="btn-fun gradient-primary text-primary-foreground gap-2">
                  <Plus className="w-4 h-4" />
                  新增頁面
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增頁面</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>頁面標題</Label>
                    <Input
                      value={newPage.title}
                      onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                      placeholder="例：我的資料"
                      className="input-fun"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL 路徑</Label>
                    <Input
                      value={newPage.slug}
                      onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })}
                      placeholder="例：my-data"
                      className="input-fun"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>描述</Label>
                    <Input
                      value={newPage.description}
                      onChange={(e) => setNewPage({ ...newPage, description: e.target.value })}
                      placeholder="頁面描述"
                      className="input-fun"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsCreatingPage(false)}>
                      取消
                    </Button>
                    <Button onClick={createPage} className="gradient-primary text-primary-foreground">
                      創建
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>頁面</TableHead>
                  <TableHead>路徑</TableHead>
                  <TableHead>最低權限</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell className="text-muted-foreground">/app/{page.slug}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeClass(page.min_role)}>
                        {page.min_role === 'admin' ? '管理員' : page.min_role === 'premium' ? '高級會員' : '會員'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={page.is_active ? 'default' : 'secondary'}>
                        {page.is_active ? '啟用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingPage(page)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePage(page.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Page Dialog */}
        <Dialog open={!!editingPage} onOpenChange={() => setEditingPage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>編輯頁面</DialogTitle>
            </DialogHeader>
            {editingPage && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>頁面標題</Label>
                  <Input
                    value={editingPage.title}
                    onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                    className="input-fun"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL 路徑</Label>
                  <Input
                    value={editingPage.slug}
                    onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                    className="input-fun"
                  />
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Input
                    value={editingPage.description || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, description: e.target.value })}
                    className="input-fun"
                  />
                </div>
                <div className="space-y-2">
                  <Label>最低權限</Label>
                  <Select
                    value={editingPage.min_role}
                    onValueChange={(value) => setEditingPage({ ...editingPage, min_role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">會員</SelectItem>
                      <SelectItem value="premium">高級會員</SelectItem>
                      <SelectItem value="admin">管理員</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditingPage(null)}>
                    取消
                  </Button>
                  <Button onClick={() => updatePage(editingPage)} className="gradient-primary text-primary-foreground">
                    <Save className="w-4 h-4 mr-1" />
                    保存
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
