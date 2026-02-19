
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Task, Attachment, Project } from '../types';
import { isWorkDay, parseUTCDate, toUTCDateString } from '../utils/dateUtils';

interface SidebarProps {
  task: Task | null;
  isShowingProjectSettings: boolean;
  activeProject?: Project;
  allTasks: Task[];
  onClose: () => void;
  onUpdateTask: (updates: Partial<Task>) => void;
  onDeleteProject: () => void;
}

const COLORS = [
  { name: 'Default', value: '' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Slate', value: '#64748b' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Indigo', value: '#6366f1' },
];

const CalendarPicker: React.FC<{
  currentDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  triggerRect: DOMRect | null;
}> = ({ currentDate, onSelect, onClose, triggerRect }) => {
  const [viewDate, setViewDate] = useState(() => {
    const d = currentDate ? parseUTCDate(currentDate) : new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });
  
  const containerRef = useRef<HTMLDivElement>(null);

  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();

  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const daysInMonth = lastDayOfMonth.getUTCDate();
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();

  const prevMonth = () => setViewDate(new Date(Date.UTC(year, month - 1, 1)));
  const nextMonth = () => setViewDate(new Date(Date.UTC(year, month + 1, 1)));

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`pad-${i}`} className="h-8 w-8"></div>);
  }

  const today = toUTCDateString(new Date());

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toUTCDateString(new Date(Date.UTC(year, month, d)));
    const isSelected = dateStr === currentDate;
    const isToday = dateStr === today;
    const isWork = isWorkDay(dateStr);

    days.push(
      <button
        key={d}
        type="button"
        onClick={() => onSelect(dateStr)}
        className={`h-8 w-8 rounded-full text-xs flex items-center justify-center transition-all ${
          isSelected 
            ? 'bg-blue-600 text-white font-bold shadow-md' 
            : isToday 
              ? 'text-blue-600 font-bold border border-blue-200' 
              : isWork 
                ? 'text-slate-700 hover:bg-blue-50' 
                : 'text-slate-300 hover:bg-gray-50'
        }`}
      >
        {d}
      </button>
    );
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 100,
    top: triggerRect ? triggerRect.bottom + 8 : 0,
    right: triggerRect ? window.innerWidth - triggerRect.right : 0,
  };

  if (triggerRect && triggerRect.bottom + 320 > window.innerHeight) {
    style.top = 'auto';
    style.bottom = window.innerHeight - triggerRect.top + 8;
  }

  return (
    <div 
      ref={containerRef} 
      style={style}
      className="bg-white border border-slate-200 shadow-2xl rounded-xl p-4 w-64 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500">
          <i className="fa-solid fa-chevron-left text-xs"></i>
        </button>
        <span className="text-sm font-bold text-slate-900">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500">
          <i className="fa-solid fa-chevron-right text-xs"></i>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="h-8 w-8 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
            {day}
          </div>
        ))}
        {days}
      </div>
      <div className="pt-2 border-t border-slate-100 flex justify-between items-center mt-2">
        <button 
          type="button"
          onClick={() => onSelect(today)} 
          className="text-[10px] font-bold text-blue-600 hover:underline"
        >
          Go to Today
        </button>
      </div>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ task, isShowingProjectSettings, activeProject, allTasks, onClose, onUpdateTask, onDeleteProject }) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const [isResizing, setIsResizing] = useState(false);
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);

  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 300 && newWidth <= 800) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    } else {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target as Node)) {
        setIsColorDropdownOpen(false);
      }
    };
    if (isColorDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColorDropdownOpen]);

  // Project Dashboard View only when explicitly triggered via gear icon
  if (isShowingProjectSettings && !task) {
    if (!activeProject) return null;
    return (
      <div 
        className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div 
          onMouseDown={handleResizeStart}
          className={`absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-blue-400/50 transition-colors z-[60] ${isResizing ? 'bg-blue-500' : ''}`}
        />
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex flex-col">
            <h2 className="font-bold text-slate-900 leading-tight">Project Settings</h2>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Overview & Management</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 shrink-0">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          <section>
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
              <h3 className="text-2xl font-black tracking-tight mb-1">{activeProject.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Workspace</p>
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tasks</span>
                  <div className="text-xl font-bold">{allTasks.length}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Completed</span>
                  <div className="text-xl font-bold">{allTasks.filter(t => t.progress === 100).length}</div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Properties</label>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Created On</span>
                <span className="text-sm font-semibold text-slate-700">{new Date(activeProject.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
              </div>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Project ID</span>
                <span className="text-[10px] font-mono font-bold text-slate-400">{activeProject.id}</span>
              </div>
            </div>
          </section>

          <section className="pt-6 border-t border-gray-100">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Advanced</label>
            <div className="p-2">
              <button 
                onClick={onDeleteProject}
                className="group flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors">
                  <i className="fa-solid fa-trash-can"></i>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-red-600">Delete Project</span>
                  <span className="text-[10px] text-red-400/80 font-medium">Permanently remove this chart and all tasks</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Task Detail View
  if (!task) return null;

  const handleAddAttachment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const url = formData.get('url') as string;
    
    if (!name || !url) return;

    const newAttachment: Attachment = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      url,
      type: url.startsWith('http') ? 'link' : 'file',
      createdAt: new Date().toISOString()
    };

    onUpdateTask({ attachments: [...task.attachments, newAttachment] });
    e.currentTarget.reset();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length === 0) return;

    const newAttachments: Attachment[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file), 
      type: 'file',
      createdAt: new Date().toISOString()
    }));

    onUpdateTask({ attachments: [...task.attachments, ...newAttachments] });
  };

  const removeAttachment = (id: string) => {
    const attachment = task.attachments.find(a => a.id === id);
    if (attachment?.type === 'file' && attachment.url.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.url);
    }
    onUpdateTask({ attachments: task.attachments.filter(a => a.id !== id) });
  };

  const toggleDependency = (depId: string) => {
    const isPresent = task.dependencies.includes(depId);
    if (isPresent) {
      onUpdateTask({ dependencies: task.dependencies.filter(id => id !== depId) });
    } else {
      onUpdateTask({ dependencies: [...task.dependencies, depId] });
    }
  };

  const handlePickerToggle = (type: 'start' | 'end', ref: React.RefObject<HTMLDivElement | null>) => {
    if (activePicker === type) {
      setActivePicker(null);
    } else {
      if (ref.current) {
        setPickerRect(ref.current.getBoundingClientRect());
      }
      setActivePicker(type);
    }
  };

  const availableTasks = allTasks.filter(t => t.id !== task.id);
  const currentColor = COLORS.find(c => c.value === task.color) || COLORS[0];

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div 
        onMouseDown={handleResizeStart}
        className={`absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-blue-400/50 transition-colors z-[60] ${isResizing ? 'bg-blue-500' : ''}`}
      />

      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
        <div className="flex flex-col overflow-hidden">
          <h2 className="font-bold text-slate-900 truncate leading-tight">{task.name || 'Task Details'}</h2>
          {task.assignee && <span className="text-[10px] text-slate-500 flex items-center gap-1"><i className="fa-solid fa-user"></i> {task.assignee}</span>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 shrink-0">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <section>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Details</label>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Name</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow bg-white text-slate-900 font-medium"
                value={task.name}
                onChange={(e) => onUpdateTask({ name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                Assignee
              </label>
              <input 
                type="text" 
                placeholder="Unassigned"
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-slate-900 font-medium placeholder:text-gray-400"
                value={task.assignee || ''}
                onChange={(e) => onUpdateTask({ assignee: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="relative" ref={colorDropdownRef}>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Color</label>
          <button
            type="button"
            onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
            className="w-full flex items-center justify-between border border-gray-300 rounded-md p-2 bg-white hover:border-blue-400 transition-colors focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full border border-gray-200" 
                style={{ backgroundColor: currentColor.value || '#f1f5f9' }}
              ></div>
              <span className="text-sm font-medium text-slate-900">{currentColor.name}</span>
            </div>
            <i className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform ${isColorDropdownOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {isColorDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-[70] max-h-60 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
              {COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => {
                    onUpdateTask({ color: color.value });
                    setIsColorDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    task.color === color.value || (!task.color && color.value === '') ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-200 shrink-0" 
                    style={{ backgroundColor: color.value || '#f1f5f9' }}
                  ></div>
                  <span className={`flex-1 text-left font-medium ${task.color === color.value || (!task.color && color.value === '') ? 'text-blue-600' : 'text-slate-700'}`}>
                    {color.name}
                  </span>
                  {(task.color === color.value || (!task.color && color.value === '')) && (
                    <i className="fa-solid fa-check text-[10px] text-blue-600"></i>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Start Date</label>
              <div 
                ref={startRef}
                onClick={() => handlePickerToggle('start', startRef)}
                className={`w-full border rounded-md p-2 text-sm font-medium flex items-center justify-between cursor-pointer transition-colors ${activePicker === 'start' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : 'border-gray-300 bg-white text-slate-900 hover:border-blue-400'}`}
              >
                <span className="truncate">{task.startDate}</span>
                <i className="fa-regular fa-calendar text-slate-400"></i>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">End Date</label>
              <div 
                ref={endRef}
                onClick={() => handlePickerToggle('end', endRef)}
                className={`w-full border rounded-md p-2 text-sm font-medium flex items-center justify-between cursor-pointer transition-colors ${activePicker === 'end' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : 'border-gray-300 bg-white text-slate-900 hover:border-blue-400'}`}
              >
                <span className="truncate">{task.endDate}</span>
                <i className="fa-regular fa-calendar text-slate-400"></i>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Duration (days)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                className="flex-1 border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-slate-900 font-medium"
                value={task.duration}
                min="1"
                onChange={(e) => onUpdateTask({ duration: parseInt(e.target.value) || 1 })}
              />
              <div className="w-12 text-center text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-200 rounded py-2">DAYS</div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            Dependencies
          </h3>
          <div className="space-y-2 mb-3">
            {task.dependencies.map(depId => {
              const depTask = allTasks.find(t => t.id === depId);
              return (
                <div key={depId} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-100 transition-all hover:border-blue-300">
                  <span className="text-xs font-medium text-blue-800 truncate pr-2">
                    {depTask?.name || 'Unknown Task'}
                  </span>
                  <button 
                    type="button"
                    onClick={() => toggleDependency(depId)}
                    className="text-blue-400 hover:text-red-500 p-1"
                  >
                    <i className="fa-solid fa-circle-xmark"></i>
                  </button>
                </div>
              );
            })}
            {task.dependencies.length === 0 && (
              <p className="text-xs text-slate-400 italic py-2 border border-dashed border-gray-200 rounded text-center">No dependencies</p>
            )}
          </div>
          <select 
            className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-900 font-medium"
            onChange={(e) => {
              if (e.target.value) {
                toggleDependency(e.target.value);
                e.target.value = "";
              }
            }}
            value=""
          >
            <option value="" disabled>Link to predecessor...</option>
            {availableTasks
              .filter(t => !task.dependencies.includes(t.id))
              .map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))
            }
          </select>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
            Attachments & Links
            <i className="fa-solid fa-cloud-arrow-up text-blue-500"></i>
          </h3>
          
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`space-y-2 mb-4 p-4 border-2 border-dashed rounded-xl transition-all duration-200 min-h-[120px] relative ${
              isDraggingFile 
                ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            {isDraggingFile && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 rounded-xl pointer-events-none">
                <p className="text-blue-600 font-bold text-sm">Drop to upload</p>
              </div>
            )}
            
            {task.attachments.length === 0 && !isDraggingFile && (
              <div className="text-center py-6">
                <i className="fa-solid fa-file-import text-slate-300 text-3xl mb-2"></i>
                <p className="text-xs text-slate-400 italic">Drag & drop files here</p>
              </div>
            )}

            {task.attachments.map(att => (
              <div key={att.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-100 group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${att.type === 'link' ? 'bg-green-50' : 'bg-blue-50'}`}>
                    <i className={`fa-solid ${att.type === 'link' ? 'fa-link text-green-500' : 'fa-file-lines text-blue-500'}`}></i>
                  </div>
                  <div className="overflow-hidden">
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 hover:underline truncate block">
                      {att.name}
                    </a>
                    <span className="text-[10px] text-slate-400">{new Date(att.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-inner">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Add Link Manually</h4>
            <form onSubmit={handleAddAttachment} className="space-y-2">
              <input name="name" placeholder="Name (e.g., Project Doc)" className="text-sm w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium" required />
              <input name="url" placeholder="URL (https://...)" className="text-sm w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium" required />
              <button type="submit" className="w-full bg-blue-600 text-white text-sm py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md active:scale-[0.98] transition-all">
                Attach Link
              </button>
            </form>
          </div>
        </section>
      </div>

      {activePicker && (
        <CalendarPicker 
          currentDate={activePicker === 'start' ? task.startDate : task.endDate} 
          onSelect={(date) => {
            onUpdateTask(activePicker === 'start' ? { startDate: date } : { endDate: date });
            setActivePicker(null);
          }}
          onClose={() => setActivePicker(null)}
          triggerRect={pickerRect}
        />
      )}
    </div>
  );
};

export default Sidebar;
