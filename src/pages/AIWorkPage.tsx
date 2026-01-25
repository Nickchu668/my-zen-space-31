import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Sparkles, MessageSquare, Image, FileText, Zap, ArrowRight } from 'lucide-react';

interface AITool {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

export function AIWorkPage() {
  const [tools] = useState<AITool[]>([
    { 
      id: '1', 
      title: '智能對話', 
      description: '與 AI 助手進行對話，獲取答案和建議',
      icon: MessageSquare,
      color: 'bg-blue-500/10 text-blue-500'
    },
    { 
      id: '2', 
      title: '圖像生成', 
      description: '使用 AI 生成創意圖像和設計',
      icon: Image,
      color: 'bg-purple-500/10 text-purple-500'
    },
    { 
      id: '3', 
      title: '文檔處理', 
      description: '智能分析和總結文檔內容',
      icon: FileText,
      color: 'bg-green-500/10 text-green-500'
    },
    { 
      id: '4', 
      title: '自動化工作流', 
      description: '設置自動化任務和工作流程',
      icon: Zap,
      color: 'bg-amber-500/10 text-amber-500'
    },
  ]);

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center animate-float">
              <Bot className="w-7 h-7 text-accent-foreground" />
            </div>
            <div>
              <h1 className="section-title mb-1">AI 工作</h1>
              <p className="text-muted-foreground">探索 AI 工具，提升工作效率</p>
            </div>
          </div>
        </div>

        {/* AI Banner */}
        <Card className="card-fun mb-8 overflow-hidden relative">
          <div className="absolute inset-0 gradient-primary opacity-10" />
          <CardContent className="p-8 relative">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-float animate-bounce-soft">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">AI 助手已就緒</h2>
                <p className="text-muted-foreground mb-4">
                  使用最新的 AI 技術來幫助你完成各種任務
                </p>
                <Button className="btn-fun gradient-primary text-primary-foreground gap-2">
                  開始使用
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <Card key={tool.id} className="card-fun group cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tool.color} group-hover:scale-110 transition-transform`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{tool.title}</h3>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">最近活動</h2>
          <Card className="card-fun">
            <CardContent className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無活動記錄</p>
                <p className="text-sm">開始使用 AI 工具來查看活動歷史</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
