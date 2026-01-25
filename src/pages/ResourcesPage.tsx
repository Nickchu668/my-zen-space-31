import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus, ExternalLink, Link2, FileText, Star } from 'lucide-react';

interface Resource {
  id: string;
  title: string;
  url?: string;
  description?: string;
  category?: string;
}

export function ResourcesPage() {
  const [resources] = useState<Resource[]>([
    { id: '1', title: '設計資源庫', description: 'UI/UX 設計靈感和素材', category: '設計' },
    { id: '2', title: '開發文檔', description: '技術文檔和教程', category: '開發' },
    { id: '3', title: '學習資料', description: '線上課程和書籍', category: '學習' },
  ]);

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
          <Button className="btn-fun gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" />
            新增資料
          </Button>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <Card key={resource.id} className="card-fun group cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Star className="w-4 h-4" />
                  </Button>
                </div>
                <CardTitle className="text-lg font-semibold mt-3">
                  {resource.title}
                </CardTitle>
                <CardDescription>{resource.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="px-2 py-1 rounded-lg bg-muted text-xs font-medium">
                    {resource.category}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty state card */}
          <Card className="card-fun border-dashed border-2 cursor-pointer group hover:border-primary/50">
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                <Plus className="w-6 h-6 group-hover:text-primary transition-colors" />
              </div>
              <p className="font-medium">新增類別</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick links section */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">快速連結</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'GitHub', url: '#' },
              { title: 'Notion', url: '#' },
              { title: 'Figma', url: '#' },
              { title: 'Google Drive', url: '#' },
            ].map((link, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:shadow-soft transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Link2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="font-medium flex-1">{link.title}</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
