import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { OrgNode, Employee } from '../types';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const getOppositeDarkColor = (hex: string) => {
  if (!hex) return '#1e293b';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  if (hex.length !== 6) return '#1e293b';
  
  let r = parseInt(hex.slice(0, 2), 16) / 255;
  let g = parseInt(hex.slice(2, 4), 16) / 255;
  let b = parseInt(hex.slice(4, 6), 16) / 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = (h + 0.5) % 1;
  l = Math.min(l, 0.25);
  s = Math.max(s, 0.7);

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  let p = 2 * l - q;
  let outR = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  let outG = Math.round(hue2rgb(p, q, h) * 255);
  let outB = Math.round(hue2rgb(p, q, h - 1/3) * 255);

  return `#${outR.toString(16).padStart(2, '0')}${outG.toString(16).padStart(2, '0')}${outB.toString(16).padStart(2, '0')}`;
};

export default function SharedOrgChartViewer({ shareId }: { shareId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [chartName, setChartName] = useState('');
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [theme, setTheme] = useState<'classic' | 'modern' | 'minimal' | 'technical' | 'elegant' | 'playful' | 'glassmorphic' | 'brutalist'>('modern');

  const fetchSharedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_shared_chart_data', {
        p_share_id: shareId,
        p_password: password
      });

      if (error) {
        throw error;
      }

      setChartName(data.chart.name);
      setNodes(data.nodes || []);
      setEmployees(data.employees || []);
    } catch (err: any) {
      if (err.message?.includes('Incorrect password')) {
        setError('password_required');
      } else {
        setError(err.message || 'Error loading shared chart');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedData();
  }, [shareId]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSharedData();
  };

  const buildTree = (nodes: OrgNode[], parentId: string | null = null): any[] => {
    return nodes
      .filter((node) => node.parent_id === parentId)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map((node) => ({
        ...node,
        children: buildTree(nodes, node.id),
      }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error === 'password_required') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
        <Card className="w-full max-w-md p-8 border-none shadow-xl text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
            <Lock size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">الهيكل التنظيمي محمي بكلمة مرور</h2>
            <p className="text-sm text-slate-500">يرجى إدخال كلمة المرور للوصول إلى هذا الهيكل التنظيمي</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="w-full flex-col flex gap-4">
            <Input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-center"
              required
            />
            <Button type="submit" className="w-full">دخول</Button>
          </form>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans" dir="rtl">
        <Card className="p-8 text-center text-red-500">
          <h2 className="text-xl font-bold mb-2">خطأ</h2>
          <p>{error}</p>
        </Card>
      </div>
    );
  }

  const treeData = buildTree(nodes);

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <header className="bg-white border-b border-slate-200 p-4 shadow-sm flex items-center justify-between sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{chartName}</h1>
          <p className="text-sm text-slate-500">عرض للقراءة فقط</p>
        </div>
      </header>

      <div className="p-8 w-full overflow-auto" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="min-w-max mx-auto flex justify-center pb-32">
          {treeData.map((branch, index) => (
            <ReadOnlyNode key={branch.id} branch={branch} index={index} employees={employees} theme={theme} />
          ))}
          {treeData.length === 0 && (
            <div className="text-slate-400">الهيكل التنظيمي فارغ</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-using the minimal subset of styles for a read-only viewer
const ReadOnlyNode: React.FC<{
  branch: any;
  depth?: number;
  index?: number;
  employees: any[];
  theme: 'classic' | 'modern' | 'minimal' | 'technical' | 'elegant' | 'playful' | 'glassmorphic' | 'brutalist';
}> = ({ branch, depth = 0, index, employees, theme }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const nodeInfo = branch;
  const isRoot = depth === 0;
  const isEffectiveHorizontal = nodeInfo.layout === 'horizontal' || (!nodeInfo.layout && depth < 1);
  const employee = employees.find((e) => e.id === nodeInfo.employee_id);
  const hasChildren = branch.children && branch.children.length > 0;

  // Styling identical to OrgChart (simplified)
  let content = null;

  if (isRoot) {
    content = (
      <div 
        className="px-20 py-8 flex items-center justify-center min-w-[400px] relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-900 rounded-[60px] border-[10px] border-white/20 shadow-2xl text-white cursor-pointer hover:scale-105 transition-transform"
        onClick={() => hasChildren && setIsCollapsed(!isCollapsed)}
      >
        <div className="text-center">
          <div className="font-bold text-sm tracking-widest text-blue-200 uppercase mb-2">الإدارة العليا</div>
          <div className="text-5xl font-black mb-4 drop-shadow-lg">{nodeInfo.title}</div>
          {employee && (
            <div className="inline-flex flex-col items-center gap-1 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 shadow-inner">
              <span className="font-extrabold text-2xl text-white">{employee.name}</span>
              <span className="text-blue-200 font-medium">{employee.job_title}</span>
            </div>
          )}
          {hasChildren && (
            <div className="mt-4 text-sm font-bold text-blue-200 opacity-80">
              {isCollapsed ? 'عرض الأقسام' : 'إخفاء الأقسام'}
            </div>
          )}
        </div>
      </div>
    );
  } else if (nodeInfo.type === 'department' && depth === 1) {
    const headerColor = nodeInfo.color || '#3b82f6';
    content = (
      <div 
        className="w-[320px] overflow-hidden rounded-3xl border-4 border-slate-100 shadow-xl bg-white mb-4 cursor-pointer hover:shadow-2xl transition-all hover:scale-105"
        onClick={() => hasChildren && setIsCollapsed(!isCollapsed)}
      >
        <div 
          className="px-10 py-6 text-center font-black text-white text-2xl"
          style={{ backgroundColor: headerColor }}
        >
          {nodeInfo.title}
          {hasChildren && (
            <div className="text-xs opacity-80 mt-1 font-normal">
              {isCollapsed ? '(مغلق)' : '(مفتوح)'}
            </div>
          )}
        </div>
        {employee && (
          <div className="p-5 flex flex-col items-center justify-center border-t border-slate-50 bg-slate-50">
            <div className={`text-2xl font-black ${theme === 'brutalist' ? 'text-black' : 'text-slate-800'}`} style={{ color: theme === 'brutalist' ? '#000' : getOppositeDarkColor(nodeInfo.color || '#3b82f6') }}>{employee.name}</div>
            <div className="text-sm font-bold text-slate-500">{employee.job_title}</div>
          </div>
        )}
      </div>
    );
  } else if (nodeInfo.type === 'department' && depth > 1) {
    content = (
      <div 
        className="w-[260px] overflow-hidden flex flex-col rounded-2xl border-2 border-slate-200 shadow-md bg-white mb-4 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
        style={{ borderTopColor: nodeInfo.color || '#64748b' }}
        onClick={() => hasChildren && setIsCollapsed(!isCollapsed)}
      >
        <div className="px-6 py-4 flex flex-col items-center justify-center">
          <span className="font-black text-lg text-slate-700">{nodeInfo.title}</span>
          {hasChildren && (
            <span className="text-[10px] text-slate-400 mt-1">{isCollapsed ? 'اضغط للفتح' : 'اضغط للإخفاء'}</span>
          )}
        </div>
        {employee && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center flex flex-col items-center">
            <span className={`text-2xl font-black ${theme === 'brutalist' ? 'text-black' : 'text-slate-800'}`} style={{ color: theme === 'brutalist' ? '#000' : getOppositeDarkColor(nodeInfo.color || '#64748b') }}>{employee.name}</span>
            <span className="text-xs font-bold text-slate-500">{employee.job_title}</span>
          </div>
        )}
      </div>
    );
  } else {
    content = (
      <div 
        className="w-[180px] p-4 flex flex-col items-center justify-center text-center relative overflow-hidden rounded-2xl border border-slate-100 shadow-md bg-white"
        style={{ borderColor: nodeInfo.color || '#e2e8f0', backgroundColor: nodeInfo.color ? `${nodeInfo.color}15` : 'white' }}
      >
        {employee && (
          <>
            <div className={`text-2xl font-black leading-snug mb-2 tracking-tight drop-shadow-sm`} style={{ color: theme === 'brutalist' ? '#000' : getOppositeDarkColor(nodeInfo.color || '#3b82f6') }}>
              {employee.name}
            </div>
            <div className="text-[12px] font-extrabold px-3 py-1 rounded-lg border shadow-sm bg-slate-100/90 text-slate-700 border-slate-200/60">
              {employee.job_title}
            </div>
            {nodeInfo.shift_info && (
              <div 
                className="mt-3 text-[9px] px-2 py-1 rounded-full font-black tracking-wider uppercase text-white"
                style={{ backgroundColor: nodeInfo.color || '#64748b' }}
              >
                {nodeInfo.shift_info}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center relative mx-4">
      <div className="relative group mb-4">
        {content}
      </div>

      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center w-full animate-in fade-in zoom-in-95 duration-300">
          {/* Connector to children */}
          <div className="w-1 bg-[#94a3b8] relative" style={{ height: '30px' }}></div>
          
          <div className={`relative flex ${isEffectiveHorizontal ? 'flex-row' : 'flex-col gap-8'} justify-center w-max items-center transition-all duration-500`}>
             {/* Horizontal unifying line */}
             {isEffectiveHorizontal && branch.children.length > 1 && (
               <div className="absolute top-0 h-1 bg-[#94a3b8] rounded-full" 
                    style={{ left: '10%', right: '10%' }}></div>
             )}
            
            {branch.children.map((child: any, i: number) => (
              <div key={child.id} className="relative flex flex-col items-center">
                 {isEffectiveHorizontal && (
                  <div className="w-1 bg-[#94a3b8] relative" style={{ height: '30px' }}></div>
                 )}
                 {!isEffectiveHorizontal && i > 0 && (
                   <div className="w-1 bg-slate-200/50 relative" style={{ height: '20px' }}></div>
                 )}
                <ReadOnlyNode 
                  branch={child} 
                  depth={depth + 1} 
                  employees={employees}
                  theme={theme}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
