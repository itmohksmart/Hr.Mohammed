import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Employee, OrgNode } from '../types';
import { 
  Users, 
  Plus, 
  Trash2, 
  GripVertical, 
  Save, 
  RefreshCw, 
  Search, 
  UserPlus,
  LayoutGrid,
  Settings2,
  ChevronDown,
  ChevronUp,
  Clock,
  Briefcase,
  Download,
  Pencil,
  Palette,
  FileText,
  FileSpreadsheet,
  ArrowLeftRight,
  ArrowDown,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// Helper to get a high-contrast text color based on the node's base color
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

  // Opposite hue
  h = (h + 0.5) % 1;
  // Ensure it's a dark color for readability on light backgrounds
  l = Math.min(l, 0.25); // max 25% lightness
  s = Math.max(s, 0.7); // at least 70% saturation to keep the color distinct

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

// --- Styled Node Component ---
const OrgNodeCard: React.FC<{ 
  node: OrgNode & { children?: any[] };
  onDelete?: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onEdit?: (node: OrgNode) => void;
  onToggleLayout?: (node: OrgNode, isEffectiveHorizontal: boolean) => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  depth: number;
  index?: number;
  theme?: 'classic' | 'modern' | 'minimal' | 'technical' | 'elegant' | 'playful' | 'glassmorphic' | 'brutalist';
}> = ({ 
  node, 
  onDelete, 
  onAddChild, 
  onEdit,
  onToggleLayout,
  isDragging = false,
  isDropTarget = false,
  depth,
  index,
  theme = 'modern'
}) => {
  const { employee } = node;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: node.id,
    data: {
      type: 'NODE',
      node: node
    },
    disabled: isDragging // Disable sorting on the item itself if it's already a target for something else? No.
  });

  const dndStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // Choose header color based on type or specific node color
  const headerColor = node.color || 
    (node.type === 'department' ? 
      (depth === 0 ? '#1e3a8a' : '#475569') 
      : '#ffffff');

  const isRoot = depth === 0;
  const isMainDepartment = node.type === 'department' && depth === 1;
  const isSubDepartment = node.type === 'department' && depth > 1;
  const isEmployee = node.type !== 'department' && !isRoot;
  const isEffectiveHorizontal = node.layout === 'horizontal' || (!node.layout && depth < 1);

  if (isRoot) {
    const rootStyles = {
      modern: "rounded-[60px] border-[10px] border-white/20 shadow-[0_30px_60px_rgba(30,58,138,0.4),0_0_40px_rgba(59,130,246,0.3)] bg-gradient-to-br from-blue-600 to-blue-900",
      classic: "rounded-none border-[8px] border-[#1e3a8a] shadow-[12px_12px_0_rgba(0,0,0,0.15)] bg-[#1e3a8a]",
      minimal: "rounded-2xl border-4 border-slate-800 shadow-none bg-white",
      technical: "rounded-xl border-2 border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)] bg-slate-950",
      elegant: "rounded-[80px] border border-slate-100 shadow-[0_25px_50px_rgba(0,0,0,0.06)] bg-[#f8fafc]",
      playful: "rounded-[3rem] border-[6px] border-yellow-400 shadow-[10px_10px_0_#fbbf24] bg-indigo-500",
      glassmorphic: "rounded-3xl border border-white/40 shadow-[0_8px_32px_rgba(31,38,135,0.2)] bg-white/30 backdrop-blur-md",
      brutalist: "rounded-none border-8 border-black shadow-[16px_16px_0_#000000] bg-[#FF3366] text-black"
    };

    return (
      <div 
        ref={setNodeRef}
        style={dndStyle}
        className={`relative transition-all duration-300 ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'} group`}
      >
        <div 
          className={`px-20 py-8 flex items-center justify-center min-w-[400px] relative overflow-hidden transition-all duration-500 ${rootStyles[theme]}`}
        >
          {theme === 'modern' && (
            <>
              {/* Animated Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
              <div className="absolute inset-2 rounded-[52px] border border-white/5 pointer-events-none"></div>
            </>
          )}

          {theme === 'technical' && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.15),transparent)] animate-pulse"></div>
          )}
          
          {/* Drag Handle for Root */}
          <div {...attributes} {...listeners} className={`absolute left-8 cursor-grab active:cursor-grabbing transition-colors ${theme === 'minimal' || theme === 'elegant' ? 'text-slate-400' : 'text-white/30 hover:text-white'}`}>
            <GripVertical size={28} />
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className={`p-3 rounded-2xl border backdrop-blur-sm mb-2 ${theme === 'minimal' ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/10'}`}>
              <LayoutGrid size={32} className={`${theme === 'minimal' ? 'text-slate-800' : 'text-white'}`} />
            </div>
            <span className={`text-5xl font-black tracking-[0.15em] select-none uppercase drop-shadow-2xl ${theme === 'minimal' || theme === 'elegant' ? 'text-slate-900' : 'text-white'}`} style={{ fontFamily: 'system-ui, sans-serif' }}>
              {node.title}
            </span>
          </div>
          
          {/* Root Actions */}
          <div className="absolute top-4 right-10 hidden group-hover:flex gap-3 z-50">
            {onEdit && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(node); }} 
                className="p-3 bg-white/90 backdrop-blur shadow-2xl text-primary rounded-2xl hover:bg-white transition-all hover:scale-110 border border-white/50"
              >
                <Pencil size={20} />
              </button>
            )}
            {onAddChild && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} 
                className="p-3 bg-white/90 backdrop-blur shadow-2xl text-primary rounded-2xl hover:bg-white transition-all hover:scale-110 border border-white/50"
              >
                <Plus size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isMainDepartment) {
    const mainDeptStyles = {
      modern: "rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-2 border-slate-200/60 bg-white",
      classic: "rounded-none shadow-[8px_8px_0_rgba(0,0,0,0.15)] border-4 border-slate-800 bg-white",
      minimal: "rounded-xl border border-slate-200 shadow-none bg-white",
      technical: "rounded-xl border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] bg-slate-900",
      elegant: "rounded-[40px] shadow-[0_15px_30px_rgba(0,0,0,0.04)] border border-slate-100 bg-white",
      playful: "rounded-3xl border-4 border-indigo-400 shadow-[8px_8px_0_#818cf8] bg-white",
      glassmorphic: "rounded-2xl border border-white/30 shadow-[0_4px_16px_rgba(31,38,135,0.1)] bg-white/40 backdrop-blur-lg",
      brutalist: "rounded-none border-4 border-black shadow-[10px_10px_0_#000000] bg-[#00FFCC]"
    };

    return (
      <div 
        ref={setNodeRef}
        style={dndStyle}
        className={`relative transition-all duration-300 ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'} ${isDropTarget ? 'ring-4 ring-primary/30 ring-offset-4 rounded-3xl' : ''} group mb-4`}
      >
        <div 
          className={`w-[320px] overflow-hidden transform transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl ${mainDeptStyles[theme]}`}
        >
          <div 
            className={`px-10 py-6 text-center font-black ${theme === 'brutalist' ? 'text-black border-b-4 border-black' : 'text-white'} text-2xl tracking-wide shadow-inner relative flex flex-col items-center gap-3`}
            style={{ 
              backgroundColor: theme === 'brutalist' ? '#00FFCC' : headerColor,
              fontFamily: 'system-ui, sans-serif',
              background: theme === 'modern' ? `linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%)` : (theme === 'brutalist' ? '#00FFCC' : headerColor)
            }}
          >
            {theme === 'modern' && (
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
            )}
            
            <div className={`p-2 rounded-xl border ${theme === 'minimal' ? 'bg-slate-100 border-slate-200' : 'bg-white/20 border-white/20 backdrop-blur-md'}`}>
              <Users size={20} className={`${theme === 'minimal' ? 'text-slate-600' : 'text-white'}`} />
            </div>
            
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className={`absolute left-3 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-colors p-2 ${theme === 'minimal' ? 'text-slate-400' : 'text-white/40 hover:text-white'}`}>
              <GripVertical size={20} />
            </div>
            <span className={`relative z-10 ${theme === 'minimal' ? 'text-slate-900' : 'drop-shadow-md'}`}>{node.title}</span>
          </div>
          
          {theme === 'modern' && (
            <div className="h-1.5 w-full bg-slate-100 relative">
              <div className="absolute top-0 left-0 h-full w-1/3 bg-white/30 animate-[shimmer_2s_infinite]"></div>
            </div>
          )}
        </div>

        {/* Department Actions */}
        <div className="absolute -top-4 -right-4 hidden group-hover:flex gap-2 z-50">
          {onToggleLayout && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleLayout(node, isEffectiveHorizontal); }} 
              className="p-2.5 bg-white shadow-xl text-slate-700 hover:text-primary rounded-xl hover:bg-slate-50 transition-all border border-slate-100 hover:scale-110"
              title={isEffectiveHorizontal ? 'تبديل للرأس' : 'تبديل للأفقي'}
            >
              {isEffectiveHorizontal ? <ArrowDown size={14} /> : <ArrowLeftRight size={14} />}
            </button>
          )}
          {onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(node); }} 
              className="p-2.5 bg-white shadow-xl text-slate-700 hover:text-primary rounded-xl hover:bg-slate-50 transition-all border border-slate-100 hover:scale-110"
            >
              <Pencil size={14} />
            </button>
          )}
          {onAddChild && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} 
              className="p-2.5 bg-white shadow-xl text-slate-700 hover:text-primary rounded-xl hover:bg-slate-50 transition-all border border-slate-100 hover:scale-110"
            >
              <Plus size={14} />
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} 
              className="p-2.5 bg-white shadow-xl text-slate-700 hover:text-destructive rounded-xl hover:bg-slate-50 transition-all border border-slate-100 hover:scale-110"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isSubDepartment) {
    const subDeptStyles = {
      modern: "rounded-2xl shadow-xl border-t-4 bg-white/80 backdrop-blur-xl border-2 border-slate-100/50",
      classic: "rounded-none shadow-[6px_6px_0_rgba(0,0,0,0.1)] border-b-4 border-slate-700 bg-white",
      minimal: "rounded-lg border border-slate-200 shadow-none bg-white",
      technical: "rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)] bg-slate-900/40",
      elegant: "rounded-[30px] shadow-sm border border-slate-50 bg-white",
      playful: "rounded-2xl border-4 border-slate-200 shadow-[6px_6px_0_#cbd5e1] bg-white",
      glassmorphic: "rounded-xl border border-white/20 shadow-[0_4px_16px_rgba(31,38,135,0.05)] bg-white/50 backdrop-blur-md",
      brutalist: "rounded-none border-4 border-black shadow-[6px_6px_0_#000000] bg-[#FFFF00]"
    };

    return (
      <div 
        ref={setNodeRef}
        style={dndStyle}
        className={`relative transition-all duration-300 ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'} ${isDropTarget ? 'ring-4 ring-primary/20 ring-offset-2 rounded-2xl' : ''} group mb-4`}
      >
        <div 
          className={`w-[260px] overflow-hidden flex flex-col transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl ${subDeptStyles[theme]}`}
          style={{ 
            borderTopColor: (theme === 'modern' || theme === 'classic' || theme === 'technical') ? (node.color || '#64748b') : undefined,
          }}
        >
          <div className={`px-6 py-4 flex items-center justify-between gap-3 ${theme === 'modern' ? 'bg-gradient-to-b from-slate-50/50 to-transparent' : ''}`}>
            {/* Icon for Section */}
            {(theme === 'modern' || theme === 'technical' || theme === 'classic') && (
              <div 
                className="p-2 rounded-lg bg-opacity-10 flex-shrink-0"
                style={{ backgroundColor: node.color ? `${node.color}20` : '#64748b20' }}
              >
                <LayoutGrid size={16} style={{ color: node.color || '#64748b' }} />
              </div>
            )}

            <span 
              className={`text-base font-extrabold text-slate-800 leading-tight text-right flex-1 truncate ${theme === 'minimal' ? 'font-medium' : ''}`}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {node.title}
            </span>

            {/* Drag Handle */}
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors p-1 flex-shrink-0 ${theme === 'minimal' || theme === 'elegant' ? 'text-slate-300' : 'text-slate-300 hover:text-slate-500'}`}>
              <GripVertical size={16} />
            </div>
          </div>
          
          {theme === 'modern' && (
            <div className="px-6 pb-2">
               <div className="h-0.5 w-full bg-slate-100/50 rounded-full"></div>
            </div>
          )}
        </div>

        {/* Actions for Sub-Department */}
        <div className="absolute top-1/2 -left-4 -translate-y-1/2 hidden group-hover:flex flex-col gap-1.5 z-50 animate-in fade-in slide-in-from-right-2">
          {onToggleLayout && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleLayout(node, isEffectiveHorizontal); }} 
              className="p-2 bg-white shadow-md text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-all border border-slate-100"
              title={isEffectiveHorizontal ? 'تبديل للرأس' : 'تبديل للأفقي'}
            >
              {isEffectiveHorizontal ? <ArrowDown size={12} /> : <ArrowLeftRight size={12} />}
            </button>
          )}
          {onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(node); }} 
              className="p-2 bg-white shadow-md text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-all border border-slate-100"
            >
              <Pencil size={12} />
            </button>
          )}
          {onAddChild && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} 
              className="p-2 bg-white shadow-md text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-all border border-slate-100"
            >
              <Plus size={12} />
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} 
              className="p-2 bg-white shadow-md text-slate-600 hover:text-destructive rounded-lg hover:bg-slate-50 transition-all border border-slate-100"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }


  // Employee/Role Card
  const employeeStyles = {
    modern: "rounded-xl shadow-lg border-2",
    classic: "rounded-none shadow-[4px_4px_0_rgba(0,0,0,0.1)] border-2",
    minimal: "rounded-lg border border-slate-200 shadow-none",
    technical: "rounded-lg border border-cyan-500/20 shadow-none bg-slate-950",
    elegant: "rounded-[20px] shadow-sm border border-slate-50",
    playful: "rounded-xl border-4 shadow-[4px_4px_0_#cbd5e1]",
    glassmorphic: "rounded-xl border border-white/20 shadow-[0_2px_8px_rgba(31,38,135,0.05)] bg-white/60 backdrop-blur-sm",
    brutalist: "rounded-none border-2 border-black shadow-[4px_4px_0_#000000] bg-[#FFFFFF]"
  };

  return (
    <div 
      ref={setNodeRef}
      style={dndStyle}
      className={`relative transition-all duration-300 ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'} ${isDropTarget ? 'ring-2 ring-primary ring-offset-2' : ''} group`}
    >
      <div 
        className={`w-[180px] p-4 flex flex-col items-center justify-center text-center relative overflow-hidden transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl ${employeeStyles[theme]}`}
        style={{ 
          backgroundColor: (theme === 'technical' || theme === 'brutalist' || theme === 'glassmorphic') ? undefined : (node.color ? `${node.color}15` : 'white'),
          borderColor: theme === 'brutalist' ? '#000' : (node.color || '#e2e8f0'),
        }}
      >
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className={`absolute left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-colors p-1 ${theme === 'technical' ? 'text-cyan-500/50 hover:text-cyan-400' : 'text-slate-300 hover:text-primary'}`}
        >
          <GripVertical size={14} />
        </div>

        {/* Color accent bar at the top */}
        {theme !== 'minimal' && (
          <div 
            className="absolute top-0 left-0 right-0 h-1.5" 
            style={{ backgroundColor: node.color || '#475569' }} 
          />
        )}
        
        {employee ? (
          <>
            <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-black border ${theme === 'technical' ? 'bg-slate-800 text-cyan-500 border-cyan-500/20 rounded-lg' : (theme === 'brutalist' ? 'bg-black text-white border-black rounded-none' : (theme === 'glassmorphic' ? 'bg-white/50 text-slate-600 rounded-lg backdrop-blur-sm' : 'bg-slate-100 text-slate-400 border-slate-200 rounded-lg'))}`}>
              #{index}
            </div>
            <div 
              className={`text-2xl font-black leading-snug mb-2 tracking-tight ${theme === 'minimal' || theme === 'brutalist' ? 'text-slate-900 drop-shadow-none' : 'drop-shadow-sm'}`}
              style={{ color: theme === 'technical' ? '#06b6d4' : (theme === 'brutalist' ? '#000' : getOppositeDarkColor(node.color || '#3b82f6')) }}
            >
              {employee.name}
            </div>
            <div className={`text-[12px] font-extrabold px-3 py-1 rounded-lg border shadow-sm ${theme === 'technical' ? 'bg-slate-900 text-slate-300 border-slate-800' : (theme === 'brutalist' ? 'bg-black text-white border-black rounded-none' : 'bg-slate-100/90 text-slate-700 border-slate-200/60')}`}>
              {employee.job_title}
            </div>
            {node.shift_info && (
              <div 
                className={`mt-3 text-[9px] px-2 py-1 rounded-full font-black tracking-wider uppercase ${theme === 'technical' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : (theme === 'brutalist' ? 'bg-transparent text-black border-2 border-black rounded-none' : 'text-white')}`}
                style={{ backgroundColor: (theme === 'technical' || theme === 'brutalist') ? undefined : (node.color || '#64748b') }}
              >
                {node.shift_info}
              </div>
            )}
          </>
        ) : (
          <div className={`text-sm font-medium italic py-2 ${theme === 'technical' ? 'text-slate-600' : 'text-slate-400'}`}>
            {node.type === 'empty' ? '(شاغر)' : 'اسحب موظف هنا'}
          </div>
        )}

        {/* Actions inside the card but styled better */}
        <div className="absolute bottom-1 right-1 hidden group-hover:flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(node); }} 
            className="p-1 bg-white shadow-sm text-slate-400 hover:text-primary rounded-md border border-slate-100"
          >
            <Pencil size={10} />
          </button>
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} 
              className="p-1 bg-white shadow-sm text-slate-400 hover:text-destructive rounded-md border border-slate-100"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Draggable Employee Item ---
const DraggableEmployee: React.FC<{ employee: Employee }> = ({ employee }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `emp-${employee.id}`,
    data: {
      type: 'EMPLOYEE',
      employee
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all flex items-center gap-3 ${isDragging ? 'opacity-50 z-50' : 'opacity-100'}`}
    >
      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
        {employee.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{employee.name}</p>
        <p className="text-[10px] text-slate-500 truncate">{employee.job_title}</p>
      </div>
      <GripVertical size={14} className="text-slate-300" />
    </div>
  );
};

export default function OrgChart() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [charts, setCharts] = useState<any[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPanningDisabled, setIsPanningDisabled] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [isAddingChart, setIsAddingChart] = useState(false);
  const [newChartName, setNewChartName] = useState('');
  const [currentTheme, setCurrentTheme] = useState<'classic' | 'modern' | 'minimal' | 'technical' | 'elegant' | 'playful' | 'glassmorphic' | 'brutalist'>('modern');

  // Share link state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiresIn, setShareExpiresIn] = useState('7');
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedChartId) {
      fetchChartNodes(selectedChartId);
    }
  }, [selectedChartId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch employees
      const empRes = await supabase.from('employees').select('*, location:locations(name)').order('first_name');
      if (!empRes.error) {
        setEmployees((empRes.data || []).map(emp => ({
          ...emp,
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
        })));
      }

      // 2. Fetch charts
      const { data: chartsData, error: chartsError } = await supabase
        .from('org_charts')
        .select('*')
        .order('created_at', { ascending: false });

      if (chartsError) throw chartsError;

      setCharts(chartsData || []);
      
      if (chartsData && chartsData.length > 0) {
        setSelectedChartId(chartsData[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Initial Fetch Error:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
      setLoading(false);
    }
  };

  const fetchChartNodes = async (chartId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('org_nodes')
        .select('*')
        .eq('chart_id', chartId)
        .order('display_order');

      if (error) throw error;

      if (data && data.length > 0) {
        setNodes(data.map(n => ({
          ...n,
          parent_id: n.parent_id
        })));
      } else {
        // Default root for new chart
        setNodes([
          {
            id: `root-${chartId}`,
            chart_id: chartId,
            title: 'قطاع الهورة',
            type: 'department',
            parent_id: null,
            color: '#1e3a8a',
            display_order: 0,
          }
        ]);
      }
    } catch (error) {
      console.error('Fetch Nodes Error:', error);
      toast.error('فشل تحميل الهيكل');
    } finally {
      setLoading(false);
    }
  };

  const createChart = async () => {
    if (!newChartName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('org_charts')
        .insert([{ name: newChartName }])
        .select()
        .single();

      if (error) throw error;

      setCharts([data, ...charts]);
      setSelectedChartId(data.id);
      setIsAddingChart(false);
      setNewChartName('');
      toast.success('تم إنشاء الهيكل بنجاح');
    } catch (error: any) {
      toast.error('فشل إنشاء الهيكل: ' + error.message);
    }
  };

  const saveStructure = async () => {
    if (!selectedChartId) return;
    const toastId = toast.loading('جاري حفظ الهيكل التنظيمي...');
    try {
      // 1. Delete existing nodes for this chart to ensure consistency
      // (This handles deletions in UI)
      const { error: delError } = await supabase
        .from('org_nodes')
        .delete()
        .eq('chart_id', selectedChartId);

      if (delError) throw delError;

      // 2. Prepare new nodes
      const validNodes = nodes.map(n => ({
        id: n.id,
        chart_id: selectedChartId,
        title: n.title,
        type: n.type,
        employee_id: n.employee_id || null,
        parent_id: n.parent_id || null,
        color: n.color || null,
        display_order: n.display_order || 0,
        shift_info: n.shift_info || null,
        layout: n.layout || null
      }));

      // 3. Insert fresh nodes
      const { error: insError } = await supabase
        .from('org_nodes')
        .insert(validNodes);

      if (insError) throw insError;

      toast.success('تم حفظ الهيكل بنجاح', { id: toastId });
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('فشل حفظ الهيكل: ' + error.message, { id: toastId });
    }
  };

  const handleUpdateNode = (updatedNode: OrgNode) => {
    setNodes(nodes.map(n => n.id === updatedNode.id ? updatedNode : n));
    setEditingNode(null);
    toast.success('تم تحديث القسم');
  };

  const handleToggleLayout = (node: OrgNode, isEffectiveHorizontal: boolean = false) => {
    const newLayout = isEffectiveHorizontal ? 'vertical' : 'horizontal';
    setNodes(nodes.map(n => n.id === node.id ? { ...n, layout: newLayout } : n));
    toast.success(`تم تغيير التنسيق إلى ${newLayout === 'horizontal' ? 'أفقي' : 'رأسي'}`);
  };

  const addNode = (parentId: string | null) => {
    const parent = nodes.find(n => n.id === parentId);
    
    // Default colors based on the palette
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#14b8a6', '#6366f1', '#ec4899'];
    const colorIndex = nodes.filter(n => n.parent_id === parentId).length % colors.length;

    const isRoot = !parentId;
    
    // We'll default to 'department' to satisfy the user's request for sections inside sections.
    const newNode: OrgNode = {
      id: Math.random().toString(36).substr(2, 9),
      title: isRoot ? 'قسم رئيسي' : (parent?.type === 'department' ? 'قسم فرعي' : 'مسمى وظيفي'),
      type: 'department', // Default to department so they can nest sub-sections
      parent_id: parentId,
      display_order: nodes.filter(n => n.parent_id === parentId).length,
      color: parentId ? (parent?.color || colors[colorIndex]) : '#2563eb'
    };
    setNodes([...nodes, newNode]);
    setEditingNode(newNode);
  };

  const deleteNode = (id: string) => {
    if (id === 'root') return;
    setNodes(nodes.filter(n => n.id !== id && n.parent_id !== id));
  };

  // --- DND Handlers ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsPanningDisabled(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsPanningDisabled(false);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 1. Employee Drop into Node
    if (active.data.current?.type === 'EMPLOYEE' && over.data.current?.type === 'NODE') {
      const employee = active.data.current.employee;
      const targetNode = over.data.current.node;

      // If target is a department or root, add as a new child person node
      if (targetNode.type === 'department' || overId === 'root') {
        const newNode: OrgNode = {
          id: Math.random().toString(36).substr(2, 9),
          title: employee.job_title,
          type: 'empty', 
          parent_id: overId,
          employee_id: employee.id,
          display_order: nodes.filter(n => n.parent_id === overId).length,
          color: targetNode.color || null
        };
        setNodes(prev => [...prev, newNode]);
      } else {
        // Otherwise replace employee in existing role node
        setNodes(prev => prev.map(node => 
          node.id === overId 
            ? { ...node, employee_id: employee.id } 
            : node
        ));
      }
      toast.success(`تم تعيين ${employee.name}`);
      return;
    }

    // 2. Node Reordering/Moving
    if (active.data.current?.type === 'NODE' && over.data.current?.type === 'NODE') {
      if (activeId === overId) return;

      const activeNode = active.data.current.node;
      const overNode = over.data.current.node;

      // Prevent moving root
      if (activeNode.parent_id === null) return;

      // Logic to either reorder siblings OR move to a new parent
      // If they share parent, it's a reorder
      if (activeNode.parent_id === overNode.parent_id) {
        const siblings = nodes
          .filter(n => n.parent_id === activeNode.parent_id)
          .sort((a, b) => a.display_order - b.display_order);
        
        const oldIndex = siblings.findIndex(n => n.id === activeId);
        const newIndex = siblings.findIndex(n => n.id === overId);
        
        const newSiblings = arrayMove(siblings, oldIndex, newIndex);
        
        setNodes(prev => {
          const others = prev.filter(n => n.parent_id !== activeNode.parent_id);
          const updatedSiblings = newSiblings.map((node: any, index) => ({
            ...node,
            display_order: index
          }));
          return [...others, ...updatedSiblings];
        });
      } else {
        // If dropping onto a department, move it as a child
        if (overNode.type === 'department' || overNode.id === 'root') {
          // Circular dependency check: Don't move a node under its own descendant
          const isDescendant = (potentialParentId: string, targetId: string): boolean => {
            const children = nodes.filter(n => n.parent_id === targetId);
            if (children.some(c => c.id === potentialParentId)) return true;
            return children.some(c => isDescendant(potentialParentId, c.id));
          };

          if (isDescendant(overId, activeId)) {
            toast.error('لا يمكن نقل القسم إلى داخل نفسه أو توابعه');
            return;
          }

          setNodes(prev => prev.map(node => 
            node.id === activeId 
              ? { ...node, parent_id: overId, display_order: prev.filter(n => n.parent_id === overId).length } 
              : node
          ));
          toast.success('تم نقل القسم');
        }
      }
    }
  };

  // --- Tree Rendering Logic ---
  const orgTree = useMemo(() => {
    const buildTree = (parentId: string | null): any[] => {
      return nodes
        .filter(n => n.parent_id === parentId)
        .sort((a, b) => a.display_order - b.display_order)
        .map(n => ({
          ...n,
          employee: employees.find(e => e.id === n.employee_id),
          children: buildTree(n.id)
        }));
    };
    return buildTree(null);
  }, [nodes, employees]);

  const unassignedEmployees = useMemo(() => {
    const assignedIds = nodes.map(n => n.employee_id).filter(Boolean);
    return employees.filter(e => {
      const isUnassigned = !assignedIds.includes(e.id);
      const searchLower = (searchTerm || "").toLowerCase();
      const matchesSearch = 
        (e.name || "").toLowerCase().includes(searchLower) || 
        (e.job_title || "").toLowerCase().includes(searchLower);
      
      return isUnassigned && matchesSearch;
    });
  }, [employees, nodes, searchTerm]);

  const exportAsImage = async () => {
    const element = document.getElementById('org-chart-printable');
    if (!element) {
      toast.error('لم يتم العثور على منطقة الهيكل');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('جاري تجهيز الصورة...');
    try {
      // Use html-to-image which handles modern CSS (oklch, flexbox) much better than html2canvas
      const dataUrl = await toPng(element, {
        backgroundColor: '#f8fafc',
        style: {
          overflow: 'visible',
          height: 'auto',
          width: 'fit-content'
        },
        pixelRatio: 2,
        // This filter can help remove elements that shouldn't be in the export
        filter: (node: any) => {
          if (node.classList && node.classList.contains('group-hover:flex')) return false;
          return true;
        }
      });
      
      const link = document.createElement('a');
      const chartName = charts.find(c => c.id === selectedChartId)?.name || 'chart';
      link.download = `org_chart_${chartName}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('تمت عملية التصدير بنجاح', { id: toastId });
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error('فشل تصدير الصورة: ' + (err.message || ''), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPdf = async () => {
    const element = document.getElementById('org-chart-printable');
    if (!element) return;

    setIsExporting(true);
    const toastId = toast.loading('جاري تجهيز ملف PDF...');
    
    try {
      const chartName = charts.find(c => c.id === selectedChartId)?.name || 'chart';
      
      // Generating PNG first using html-to-image to ensure layout integrity
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        style: {
          overflow: 'visible',
          height: 'auto',
          width: 'fit-content'
        },
        pixelRatio: 2
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a3'
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20; // 10mm margins
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 10, 10, pdfWidth, pdfHeight);
      pdf.save(`org_chart_${chartName}.pdf`);
      
      toast.success('تم تصدير ملف PDF بنجاح', { id: toastId });
    } catch (err: any) {
      console.error('PDF Export error:', err);
      toast.error('فشل تصدير ملف PDF: ' + (err.message || 'خطأ في معالجة الهيكل'), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsExcel = () => {
    const chartName = charts.find(c => c.id === selectedChartId)?.name || 'chart';
    
    // Find the path for a given node
    const getPath = (nodeId: string | null): string => {
        if (!nodeId) return 'غير محدد';
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return 'غير محدد';
        
        let path = node.title || 'بدون قسم';
        let currentParent = node.parent_id;
        
        while (currentParent) {
            const parentNode = nodes.find(n => n.id === currentParent);
            if (parentNode && parentNode.title) {
                path = `${parentNode.title} > ${path}`;
                currentParent = parentNode.parent_id;
            } else {
                currentParent = null;
            }
        }
        return path;
    };

    const headers = [
        "اسم الموظف",
        "المسمى الوظيفي",
        "مسار القسم في الهيكل",
        "القسم في الهيكل",
        "البريد الإلكتروني",
        "رقم الهاتف",
        "القسم في النظام"
    ];

    const rows = nodes
        .filter(n => n.employee_id)
        .map(n => {
            const employee = employees.find(e => e.id === n.employee_id);
            if (!employee) return null;
            return [
                employee.name || '',
                employee.job_title || '',
                getPath(n.id) || '',
                n.title || 'بدون قسم',
                employee.email || '',
                employee.phone || '',
                employee.department || ''
            ];
        })
        .filter(Boolean);

    // Create CSV content with BOM for UTF-8 and Arabic support in Excel
    const csvContent = "\uFEFF" + 
        headers.join(',') + '\n' +
        rows.map(r => r!.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `org_chart_${chartName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم التصدير إلى Excel/CSV بنجاح');
  };

  const handleGenerateShareLink = async () => {
    if (!selectedChartId) return;
    setIsSharing(true);
    setSharedLink(null);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(shareExpiresIn));

      const { data, error } = await supabase
        .from('shared_charts')
        .insert({
          chart_id: selectedChartId,
          password: sharePassword || null,
          expires_at: expiresAt.toISOString(),
          created_by: 'system' // can be improved by retrieving user email from auth
        })
        .select('id')
        .single();
      
      if (error) {
        if (error.message.includes('relation "public.shared_charts" does not exist')) {
          toast.error('يرجى تنفيذ ملف supabase_schema_shared_link.sql في قاعدة البيانات أولا');
          return;
        }
        throw error;
      }

      const link = `${window.location.origin}/?shared_chart=${data.id}`;
      setSharedLink(link);
      toast.success('تم إنشاء الرابط بنجاح');
    } catch (error: any) {
      toast.error('فشل إنشاء الرابط: ' + error.message);
    } finally {
      setIsSharing(false);
    }
  };

  // --- Recursive Tree Component ---
  const RenderBranch: React.FC<{ 
    branch: any; 
    depth?: number;
    index?: number;
    onToggleLayout: (node: OrgNode, isEffectiveHorizontal: boolean) => void;
    theme: 'classic' | 'modern' | 'minimal' | 'technical' | 'elegant' | 'playful' | 'glassmorphic' | 'brutalist';
  }> = ({ branch, depth = 0, index, onToggleLayout, theme }) => {
    // We wrap each sibling group in a SortableContext for reordering
    const childIds = useMemo(() => 
      branch.children?.map((c: any) => c.id) || []
    , [branch.children]);

    // Strategy: 
    // - Respect the manual layout choice if set.
    // - Otherwise: Top 1 levels are horizontal spread if they have children.
    // - Departments at depth >= 1 usually have a vertical list unless split manually.
    const isHorizontal = branch.layout === 'horizontal' || (!branch.layout && depth < 1);
    const hasChildren = branch.children && branch.children.length > 0;

    return (
      <div className={`flex flex-col items-center`}>
        {/* Node Card */}
        <div className="z-10 group/render">
          <OrgNodeCard 
            node={branch} 
            depth={depth}
            index={index}
            onDelete={deleteNode} 
            onAddChild={addNode}
            onEdit={(node) => setEditingNode(node)}
            onToggleLayout={onToggleLayout}
            isDragging={activeId === branch.id}
            theme={theme}
          />
        </div>

        {/* Children Rendering */}
        {hasChildren && (
          <div className="flex flex-col items-center w-full">
            {/* Vertical Connector down from parent */}
            <div className="w-1 h-12 bg-[#64748b]/40"></div>

            <SortableContext items={childIds} strategy={isHorizontal ? () => null : verticalListSortingStrategy}>
              {isHorizontal ? (
                <div className="flex flex-col items-center w-full">
                  {/* Horizontal line connecting siblings */}
                  {branch.children.length > 1 && (
                    <div className="relative w-full h-1 bg-[#64748b]/40 flex justify-center">
                      <div 
                        className="absolute top-0 h-1 bg-[#64748b]/40"
                        style={{ 
                          width: `calc(100% - ${220 / branch.children.length}px)`
                        }}
                      ></div>
                    </div>
                  )}
                  
                  <div className="flex justify-center gap-10 items-start w-full">
                    {branch.children.map((child: any, idx: number) => (
                      <div key={child.id} className="flex flex-col items-center relative">
                        {/* Vertical line up to the horizontal sibling line */}
                        <div className="w-1 h-12 bg-[#64748b]/40"></div>
                        <RenderBranch branch={child} depth={depth + 1} index={idx + 1} onToggleLayout={onToggleLayout} theme={theme} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Vertical stack for nodes within a department
                <div className="flex flex-col items-center gap-0 w-full">
                  {branch.children.map((child: any, idx: number) => (
                    <div key={child.id} className="flex flex-col items-center">
                      {/* Connector for vertical stack */}
                      <div className="relative w-full flex justify-center">
                        <div className="w-1 h-8 bg-[#64748b]/40"></div>
                      </div>
                      <RenderBranch branch={child} depth={depth + 1} index={idx + 1} onToggleLayout={onToggleLayout} theme={theme} />
                    </div>
                  ))}
                </div>
              )}
            </SortableContext>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <RefreshCw size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const employeesInChartCount = new Set(nodes.filter(n => n.employee_id).map(n => n.employee_id)).size;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <LayoutGrid className="text-primary" size={28} />
              الهيكل التنظيمي
            </h1>
            {selectedChartId && (
              <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full whitespace-nowrap">
                {employeesInChartCount} موظف مدرج
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">قم ببناء وتوزيع الموظفين على الهيكل الإداري</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Chart Selector */}
          <div className="flex items-center gap-2">
            <Select value={selectedChartId || ''} onValueChange={setSelectedChartId}>
              <SelectTrigger className="w-[200px] bg-white dark:bg-slate-900 shadow-sm border-slate-200">
                <SelectValue placeholder="اختر الهيكل" />
              </SelectTrigger>
              <SelectContent>
                {charts.map(chart => (
                  <SelectItem key={chart.id} value={chart.id}>
                    {chart.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setIsAddingChart(true)} title="إنشاء هيكل جديد">
              <Plus size={18} />
            </Button>
            {selectedChartId && (
              <Button 
                variant="outline" 
                size="icon" 
                className="text-red-500 hover:bg-red-50"
                onClick={async () => {
                  if (confirm('هل أنت متأكد من حذف هذا الهيكل بالكامل؟')) {
                    const { error } = await supabase.from('org_charts').delete().eq('id', selectedChartId);
                    if (error) toast.error('فشل الحذف');
                    else {
                      setCharts(charts.filter(c => c.id !== selectedChartId));
                      setSelectedChartId(charts.length > 1 ? (charts[0].id === selectedChartId ? charts[1].id : charts[0].id) : null);
                      toast.success('تم الحذف');
                    }
                  }
                }}
                title="حذف الهيكل"
              >
                <Trash2 size={18} />
              </Button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 mr-4 border-r pr-4 border-slate-200">
            <Palette size={16} className="text-slate-400" />
            <Select value={currentTheme} onValueChange={(v: any) => setCurrentTheme(v)}>
              <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl border-slate-200 bg-white">
                <SelectValue placeholder="اختر النمط" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">النمط الحديث</SelectItem>
                <SelectItem value="classic">النمط الكلاسيكي</SelectItem>
                <SelectItem value="minimal">النمط البسيط</SelectItem>
                <SelectItem value="technical">النمط التقني</SelectItem>
                <SelectItem value="elegant">النمط الأنيق</SelectItem>
                <SelectItem value="playful">النمط المرح</SelectItem>
                <SelectItem value="glassmorphic">النمط الزجاجي</SelectItem>
                <SelectItem value="brutalist">النمط القاسي (Brutalist)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={exportAsImage} disabled={isExporting}>
            {isExporting ? <RefreshCw className="animate-spin ml-2" size={16} /> : <Download className="ml-2" size={16} />}
            تصدير كصورة
          </Button>

          <Button variant="outline" size="sm" onClick={exportAsPdf} disabled={isExporting}>
            {isExporting ? <RefreshCw className="animate-spin ml-2" size={16} /> : <FileText className="ml-2" size={16} />}
            تصدير PDF
          </Button>

          <Button variant="outline" size="sm" onClick={exportAsExcel} disabled={isExporting || !selectedChartId}>
            <FileSpreadsheet className="ml-2" size={16} />
            تصدير Excel
          </Button>

          <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" disabled={!selectedChartId} />}>
              <Share2 className="ml-2" size={16} />
              مشاركة رابط
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">مشاركة الهيكل التنظيمي</DialogTitle>
                <DialogDescription className="text-right">
                  قم بإنشاء رابط تفاعلي لمشاركة هذا الهيكل مع جهات خارجية دون الحاجة لحساب.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="sharePassword" className="text-right">كلمة المرور (اختياري)</Label>
                  <Input
                    id="sharePassword"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="اتركه فارغاً لرابط بدون حماية"
                    className="col-span-3 text-right"
                    type="password"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="shareExpiry" className="text-right">صلاحية الرابط (أيام)</Label>
                  <Input
                    id="shareExpiry"
                    value={shareExpiresIn}
                    onChange={(e) => setShareExpiresIn(e.target.value)}
                    className="col-span-3 text-right"
                    type="number"
                    min="1"
                    max="365"
                  />
                </div>
                {sharedLink && (
                  <div className="bg-slate-50 p-4 rounded-lg mt-2 border border-slate-200">
                    <p className="text-sm font-semibold mb-2">رابط المشاركة:</p>
                    <div className="flex items-center gap-2">
                      <Input value={sharedLink} readOnly className="text-left text-xs" dir="ltr" />
                      <Button 
                        size="sm" 
                        onClick={() => {
                          navigator.clipboard.writeText(sharedLink);
                          toast.success('تم نسخ الرابط');
                        }}
                      >
                        نسخ
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>إغلاق</Button>
                <Button onClick={handleGenerateShareLink} disabled={isSharing}>
                  {isSharing ? 'جاري الإنشاء...' : 'إنشاء الرابط'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button size="sm" onClick={saveStructure} className="bg-primary hover:bg-primary/90" disabled={!selectedChartId}>
            <Save className="ml-2" size={16} />
            حفظ التغييرات
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-250px)]">
          {/* Sidebar - Employees */}
          <div className="w-full lg:w-72 flex flex-col gap-4">
            <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    <Users size={18} className="text-primary" />
                    الموظفون غير المعينين
                  </h2>
                  <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {unassignedEmployees.length}
                  </span>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="بحث..." 
                    className="pr-9 h-9 text-xs rounded-xl" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <SortableContext items={unassignedEmployees.map(e => `emp-${e.id}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {unassignedEmployees.map(emp => (
                      <DraggableEmployee key={emp.id} employee={emp} />
                    ))}
                    {unassignedEmployees.length === 0 && (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <Users size={24} />
                        </div>
                        <p className="text-xs text-slate-400">لا يوجد موظفون متبقون</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            </Card>
          </div>

          {/* Org Chart Area */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden relative">
            <Card className="flex-1 overflow-hidden border-none shadow-xl bg-white rounded-2xl relative">
              <TransformWrapper
                initialScale={1}
                minScale={0.1}
                maxScale={3}
                centerOnInit={true}
                limitToBounds={false}
                panning={{ disabled: isPanningDisabled }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="absolute top-4 left-4 flex gap-2 z-50">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => zoomIn()} 
                        className="bg-white/90 backdrop-blur shadow-sm border-slate-200 hover:bg-slate-50 font-bold"
                      >
                        تكبير (+)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => zoomOut()} 
                        className="bg-white/90 backdrop-blur shadow-sm border-slate-200 hover:bg-slate-50 font-bold"
                      >
                        تصغير (-)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => resetTransform()} 
                        className="bg-white/90 backdrop-blur shadow-sm border-slate-200 hover:bg-slate-50 font-bold"
                      >
                        إعادة تعيين
                      </Button>
                    </div>
                    
                    <TransformComponent
                      wrapperStyle={{
                        width: "100%",
                        height: "100%",
                        cursor: "move"
                      }}
                      contentStyle={{
                        width: "fit-content",
                        height: "fit-content",
                        minWidth: "100%",
                        minHeight: "100%",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "100px"
                      }}
                    >
                      <div 
                        id="org-chart-printable" 
                        className="flex flex-col items-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] p-24"
                      >
                        <div className="flex justify-center">
                          {orgTree.map(root => (
                            <RenderBranch key={root.id} branch={root} onToggleLayout={handleToggleLayout} theme={currentTheme} />
                          ))}
                        </div>
                        {orgTree.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                            <LayoutGrid size={48} className="text-slate-200" />
                            <p className="text-slate-400 text-sm">لم يتم إنشاء هيكل تنظيمي بعد</p>
                            <Button onClick={() => addNode(null)}>إنشاء الهيكل الرئيسي</Button>
                          </div>
                        )}
                      </div>
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>

              {/* Action Floating Buttons */}
              <div className="absolute top-4 right-4 flex gap-2 z-50">
                <Button size="icon" variant="secondary" className="rounded-full shadow-lg h-10 w-10 border-2 border-primary/20" onClick={() => addNode(null)} title="أضف قسم رئيسي">
                  <Plus size={20} className="text-primary" />
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Drag Overlay for smooth animation */}
        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeId && activeId.toString().startsWith('emp-') ? (
            <div className="p-3 bg-white dark:bg-slate-900 border-2 border-primary rounded-xl shadow-2xl opacity-90 flex items-center gap-3 w-64 rotate-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs uppercase">
                {employees.find(e => `emp-${e.id}` === activeId)?.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {employees.find(e => `emp-${e.id}` === activeId)?.name}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {employees.find(e => `emp-${e.id}` === activeId)?.job_title}
                </p>
              </div>
              <GripVertical size={14} className="text-slate-300" />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Edit Node Dialog */}
      <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Pencil size={18} className="text-primary" />
              تعديل القسم / المكان
            </DialogTitle>
          </DialogHeader>
          {editingNode && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  المسمى
                </Label>
                <Input
                  id="title"
                  value={editingNode.title}
                  onChange={(e) => setEditingNode({ ...editingNode, title: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  النوع
                </Label>
                <Select 
                  value={editingNode.type} 
                  onValueChange={(val: any) => setEditingNode({ ...editingNode, type: val })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">قسم</SelectItem>
                    <SelectItem value="role">وظيفة</SelectItem>
                    <SelectItem value="person">موظف</SelectItem>
                    <SelectItem value="empty">شاغر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shift_info" className="text-right">
                  الوردية
                </Label>
                <Input
                  id="shift_info"
                  placeholder="مثال: 12-12 ساعة"
                  value={editingNode.shift_info || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, shift_info: e.target.value })}
                  className="col-span-3"
                />
              </div>
              {/* Color Selection - Visible for all types now */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="color" className="text-right">
                  اللون مميز
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={editingNode.color || (editingNode.type === 'department' ? '#3b82f6' : '#64748b')}
                    onChange={(e) => setEditingNode({ ...editingNode, color: e.target.value })}
                    className="w-12 h-10 p-1 rounded-lg cursor-pointer"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#475569'].map(c => (
                      <button 
                        key={c}
                        onClick={() => setEditingNode({ ...editingNode, color: c })}
                        className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${editingNode.color === c ? 'border-primary ring-2 ring-primary/20' : 'border-white shadow-sm'}`}
                        style={{ backgroundColor: c }}
                        title="اختر هذا اللون"
                      />
                    ))}
                  </div>
                </div>
              </div>
              {editingNode.type !== 'department' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">الموظف</Label>
                  <div className="col-span-3 text-sm">
                    {editingNode.employee_id ? (
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded">
                        <span className="font-bold">{employees.find(e => e.id === editingNode.employee_id)?.name}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-red-500" onClick={() => setEditingNode({ ...editingNode, employee_id: undefined })}>حذف</Button>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">يمكنك سحب موظف هنا من القائمة الجانبية</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="sm:justify-start">
            <Button type="button" onClick={() => editingNode && handleUpdateNode(editingNode)}>
              حفظ التغييرات
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditingNode(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Chart Dialog */}
      <Dialog open={isAddingChart} onOpenChange={setIsAddingChart}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إنشاء هيكل تنظيمي جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="chartName" className="text-right">اسم الهيكل</Label>
              <Input
                id="chartName"
                value={newChartName}
                onChange={(e) => setNewChartName(e.target.value)}
                className="col-span-3"
                placeholder="مثال: الهيكل المعتمد 2024"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createChart}>إنشاء</Button>
            <Button variant="ghost" onClick={() => setIsAddingChart(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
