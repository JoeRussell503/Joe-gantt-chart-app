import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, Project } from './types';
import { addDays, getDiffDays, getTimelineRange, isWeekend, isWorkDay, parseUTCDate, toUTCDateString } from './utils/dateUtils';
import { generateTasksFromPrompt, parseFileWithGemini } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ShareModal from './components/ShareModal';
import CalendarView from './components/CalendarView';

interface DragInfo {
  taskId: string;
  type: 'move' | 'resize';
  startX: number;
  originalStartDate: string;
  originalDuration: number;
  snapshot: Task[];
}

const STORAGE_KEY = 'gemini-gantt-workspace-v2';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.projects || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).activeProjectId || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Task[]>([]);
  const [isShowingProjectSettings, setIsShowingProjectSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [zoomLevel, setZoomLevel] = useState(40);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [now, setNow] = useState(new Date());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [viewType, setViewType] = useState<'gantt' | 'calendar'>('gantt');
  
  const [idOfProjectToDelete, setIdOfProjectToDelete] = useState<string | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [showUploadStep, setShowUploadStep] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);

  // Fix: Move declarations of activeProject and tasks before the useEffect that references them
  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || projects[0], 
  [projects, activeProjectId]);

  const tasks = activeProject?.tasks || [];

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        projects,
        activeProjectId
      }));
      setLastSaved(new Date());
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === 'c') {
        handleCopy();
      } else if (cmdKey && e.key.toLowerCase() === 'v') {
        handlePaste();
      } else if (e.key === 'Delete' || (cmdKey && e.key === 'Backspace')) {
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskIds, clipboard, tasks]);

  const handleCreateProject = (prePopulatedTasks: Task[] = []) => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newProject: Project = {
      id: newId,
      name: prePopulatedTasks.length > 0 ? 'Imported Project' : 'Untitled Project',
      tasks: prePopulatedTasks,
      createdAt: new Date().toISOString()
    };
    setProjects([...projects, newProject]);
    setActiveProjectId(newId);
    setSelectedTaskIds([]);
    setIsShowingProjectSettings(false);
    setIsNewProjectModalOpen(false);
    setShowUploadStep(false);
    setTimeout(() => projectNameInputRef.current?.focus(), 100);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsParsingFile(true);
    try {
      const text = await file.text();
      const generated = await parseFileWithGemini(text, file.name);
      
      const today = toUTCDateString(new Date());
      let currentStart = today;
      
      const newTasks: Task[] = generated.map((t) => {
        const id = Math.random().toString(36).substr(2, 9);
        const duration = t.duration || 5;
        const task: Task = {
          id,
          name: t.name || 'Untitled Task',
          startDate: currentStart,
          duration,
          endDate: addDays(currentStart, duration, true),
          progress: 0,
          dependencies: [], 
          attachments: [],
          status: 'Not Started',
          level: 0
        };
        currentStart = addDays(task.endDate, 2, true);
        return task;
      });

      handleCreateProject(newTasks);
    } catch (err) {
      console.error(err);
      alert("Failed to parse file. Please try a different format.");
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleDuplicateProject = () => {
    if (!activeProject) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const clonedProject: Project = {
      ...activeProject,
      id: newId,
      name: `${activeProject.name} (Copy)`,
      createdAt: new Date().toISOString()
    };
    setProjects([...projects, clonedProject]);
    setActiveProjectId(newId);
  };

  const confirmDeleteProject = () => {
    if (!idOfProjectToDelete) return;
    
    if (projects.length <= 1) {
      alert("You must have at least one project in your workspace.");
      setIdOfProjectToDelete(null);
      return;
    }

    const filtered = projects.filter(p => p.id !== idOfProjectToDelete);
    setProjects(filtered);
    
    if (activeProjectId === idOfProjectToDelete) {
      setActiveProjectId(filtered[0].id);
    }
    
    setSelectedTaskIds([]);
    setIsShowingProjectSettings(false);
    setIdOfProjectToDelete(null);
  };

  const handleUpdateProjectName = (name: string) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, name } : p));
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const updatedTasks = p.tasks.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        if (updates.startDate || (updates.duration !== undefined)) {
          updated.endDate = addDays(updated.startDate || t.startDate, updated.duration ?? t.duration, true);
        } else if (updates.endDate) {
          updated.duration = getDiffDays(updated.startDate || t.startDate, updated.endDate, true);
        }
        return updated;
      });
      return { ...p, tasks: updatedTasks };
    }));
  };

  const isParent = (index: number) => {
    if (index >= tasks.length - 1) return false;
    return tasks[index + 1].level > tasks[index].level;
  };

  const processedTasks = useMemo(() => {
    const updated = [...tasks];
    for (let i = updated.length - 1; i >= 0; i--) {
      const children = [];
      const parentLevel = updated[i].level;
      for (let j = i + 1; j < updated.length; j++) {
        if (updated[j].level <= parentLevel) break;
        if (updated[j].level === parentLevel + 1) {
          children.push(updated[j]);
        }
      }

      if (children.length > 0) {
        let minStart = children[0].startDate;
        let maxEnd = children[0].endDate;
        let totalProgress = 0;

        children.forEach(c => {
          if (c.startDate < minStart) minStart = c.startDate;
          if (c.endDate > maxEnd) maxEnd = c.endDate;
          totalProgress += c.progress;
        });

        updated[i].startDate = minStart;
        updated[i].endDate = maxEnd;
        updated[i].duration = getDiffDays(minStart, maxEnd, true);
        updated[i].progress = Math.round(totalProgress / children.length);
      }
    }
    return updated;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const visible: { task: Task, originalIndex: number }[] = [];
    let hiddenLevel = -1;

    processedTasks.forEach((task, idx) => {
      if (hiddenLevel !== -1 && task.level > hiddenLevel) return;
      hiddenLevel = -1;
      visible.push({ task, originalIndex: idx });
      if (task.isCollapsed) hiddenLevel = task.level;
    });
    return visible;
  }, [processedTasks]);

  const timelineRange = useMemo(() => getTimelineRange(processedTasks), [processedTasks]);
  const totalDays = getDiffDays(timelineRange.start, timelineRange.end, false) + 1;

  const todayStr = useMemo(() => toUTCDateString(now), [now]);

  const todayLeft = useMemo(() => {
    const start = parseUTCDate(timelineRange.start).getTime();
    const current = now.getTime();
    const diffMs = current - start;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays * zoomLevel;
  }, [now, timelineRange.start, zoomLevel]);

  const overdueTaskIds = useMemo(() => {
    const overdue = new Set<string>();
    processedTasks.forEach(task => {
      if (task.endDate < todayStr && task.progress < 100) {
        overdue.add(task.id);
      }
    });
    return overdue;
  }, [processedTasks, todayStr]);

  const handleBarMouseDown = (e: React.MouseEvent, task: Task, type: 'move' | 'resize') => {
    e.stopPropagation();
    setSelectedTaskIds([task.id]);
    setIsShowingProjectSettings(false);
    setDragInfo({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStartDate: task.startDate,
      originalDuration: task.duration,
      snapshot: [...tasks]
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo) return;
      const deltaX = e.clientX - dragInfo.startX;
      const deltaDays = Math.round(deltaX / zoomLevel);

      if (dragInfo.type === 'move') {
        const affectedIds = new Set<string>([dragInfo.taskId]);
        const queue = [dragInfo.taskId];
        let head = 0;

        while (head < queue.length) {
          const currentId = queue[head++];
          
          dragInfo.snapshot.forEach(t => {
            if (t.dependencies.includes(currentId) && !affectedIds.has(t.id)) {
              affectedIds.add(t.id);
              queue.push(t.id);
            }
          });

          const currentTask = dragInfo.snapshot.find(t => t.id === currentId);
          currentTask?.dependencies.forEach(depId => {
            if (!affectedIds.has(depId)) {
              affectedIds.add(depId);
              queue.push(depId);
            }
          });
        }

        setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const updatedTasks = p.tasks.map(t => {
            if (affectedIds.has(t.id)) {
              const originalTask = dragInfo.snapshot.find(st => st.id === t.id)!;
              const newStart = addDays(originalTask.startDate, deltaDays, false);
              const newEnd = addDays(newStart, originalTask.duration, true);
              return { ...t, startDate: newStart, endDate: newEnd };
            }
            return t;
          });
          return { ...p, tasks: updatedTasks };
        }));
      } else if (dragInfo.type === 'resize') {
        const newDuration = Math.max(1, dragInfo.originalDuration + deltaDays);
        handleUpdateTask(dragInfo.taskId, { duration: newDuration });
      }
    };
    const handleMouseUp = () => setDragInfo(null);
    if (dragInfo) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragInfo, zoomLevel, activeProjectId]);

  const handleCopy = () => {
    if (selectedTaskIds.length === 0) return;
    const toCopy = tasks.filter(t => selectedTaskIds.includes(t.id));
    setClipboard(JSON.parse(JSON.stringify(toCopy))); // Deep clone
  };

  const handlePaste = () => {
    if (clipboard.length === 0) return;
    
    const newTasks: Task[] = clipboard.map(t => ({
      ...t,
      id: Math.random().toString(36).substr(2, 9),
      dependencies: [], // Dependencies usually reset on paste to avoid loops
      progress: 0,
      status: 'Not Started'
    }));

    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, tasks: [...p.tasks, ...newTasks] };
    }));
    
    setSelectedTaskIds(newTasks.map(t => t.id));
  };

  const handleSelectTask = (e: React.MouseEvent, taskId: string, index: number) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const multiKey = isMac ? e.metaKey : e.ctrlKey;
    const shiftKey = e.shiftKey;

    if (shiftKey && selectedTaskIds.length > 0) {
      const lastSelectedId = selectedTaskIds[selectedTaskIds.length - 1];
      const lastIdx = tasks.findIndex(t => t.id === lastSelectedId);
      const start = Math.min(lastIdx, index);
      const end = Math.max(lastIdx, index);
      const rangeIds = tasks.slice(start, end + 1).map(t => t.id);
      setSelectedTaskIds(Array.from(new Set([...selectedTaskIds, ...rangeIds])));
    } else if (multiKey) {
      if (selectedTaskIds.includes(taskId)) {
        setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
      } else {
        setSelectedTaskIds([...selectedTaskIds, taskId]);
      }
    } else {
      setSelectedTaskIds([taskId]);
    }
    setIsShowingProjectSettings(false);
  };

  const indentTask = () => {
    if (selectedTaskIds.length === 0) return;
    selectedTaskIds.forEach(id => {
      const idx = tasks.findIndex(t => t.id === id);
      if (idx <= 0) return;
      if (tasks[idx].level <= tasks[idx - 1].level) {
        handleUpdateTask(id, { level: tasks[idx].level + 1 });
      }
    });
  };

  const outdentTask = () => {
    if (selectedTaskIds.length === 0) return;
    selectedTaskIds.forEach(id => {
      const idx = tasks.findIndex(t => t.id === id);
      if (idx !== -1 && tasks[idx].level > 0) {
        handleUpdateTask(id, { level: tasks[idx].level - 1 });
      }
    });
  };

  const addTask = () => {
    const lastTask = tasks[tasks.length - 1];
    const newId = Math.random().toString(36).substr(2, 9);
    let start = lastTask ? addDays(lastTask.endDate, 2, true) : toUTCDateString(new Date());
    while (!isWorkDay(start)) { start = addDays(start, 1, false); }
    
    const newTask: Task = {
      id: newId,
      name: `New Task`,
      startDate: start,
      duration: 5,
      endDate: addDays(start, 5, true),
      progress: 0,
      dependencies: [],
      attachments: [],
      status: 'Not Started',
      level: lastTask ? lastTask.level : 0
    };
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, tasks: [...p.tasks, newTask] } : p));
    setSelectedTaskIds([newId]);
    setIsShowingProjectSettings(false);
  };

  const deleteSelected = () => {
    if (selectedTaskIds.length > 0) {
      setProjects(prev => prev.map(p => p.id === activeProjectId ? { 
        ...p, 
        tasks: p.tasks.filter(t => !selectedTaskIds.includes(t.id)) 
      } : p));
      setSelectedTaskIds([]);
    }
  };

  const handleTaskDragStart = (e: React.DragEvent, originalIndex: number) => {
    setDraggedRowIndex(originalIndex);
    e.dataTransfer.effectAllowed = 'move';
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleTaskDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedRowIndex === null || draggedRowIndex === index) return;
    
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newTasks = [...p.tasks];
      const [removed] = newTasks.splice(draggedRowIndex, 1);
      newTasks.splice(index, 0, removed);
      return { ...p, tasks: newTasks };
    }));
    setDraggedRowIndex(index);
  };

  const handleTaskDragEnd = () => {
    setDraggedRowIndex(null);
  };

  const handleAiGeneration = async () => {
    if (!promptValue.trim()) return;
    setIsGenerating(true);
    try {
      const generated = await generateTasksFromPrompt(promptValue);
      const today = toUTCDateString(new Date());
      let currentStart = today;
      const newTasks: Task[] = generated.map((t) => {
        const id = Math.random().toString(36).substr(2, 9);
        const duration = t.duration || 5;
        const task: Task = {
          id,
          name: t.name || 'Untitled Task',
          startDate: currentStart,
          duration,
          endDate: addDays(currentStart, duration, true),
          progress: 0,
          dependencies: [], 
          attachments: [],
          status: 'Not Started',
          level: 0
        };
        currentStart = addDays(task.endDate, 2, true);
        return task;
      });
      setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, tasks: [...p.tasks, ...newTasks] } : p));
      setPromptValue('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (tableRef.current && tableRef.current !== e.currentTarget) {
      tableRef.current.scrollTop = scrollTop;
    }
    if (gridRef.current && gridRef.current !== e.currentTarget) {
      gridRef.current.scrollTop = scrollTop;
    }
  };

  const exportData = (format: 'csv' | 'excel' | 'google-sheets' | 'pdf') => {
    setIsExportOpen(false);

    if (format === 'pdf') {
      window.print();
      return;
    }

    const headers = ['ID', 'Task Name', 'Start Date', 'End Date', 'Duration (Days)', 'Progress (%)', 'Assignee', 'Level'];
    const rows = tasks.map((t, idx) => [
      idx + 1,
      t.name,
      t.startDate,
      t.endDate,
      t.duration,
      t.progress,
      t.assignee || 'Unassigned',
      t.level
    ]);

    const escapeCSV = (str: string | number) => {
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\n");

    const filename = `${activeProject?.name || 'project'}-export`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.${format === 'excel' ? 'xls' : 'csv'}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedTask = useMemo(() => {
    if (selectedTaskIds.length === 0) return null;
    return tasks.find(t => t.id === selectedTaskIds[selectedTaskIds.length - 1]) || null;
  }, [selectedTaskIds, tasks]);

  const conflictedTaskIds = useMemo(() => {
    const conflicts = new Set<string>();
    processedTasks.forEach(task => {
      task.dependencies.forEach(depId => {
        const sourceTask = processedTasks.find(t => t.id === depId);
        if (sourceTask && task.startDate < sourceTask.endDate) {
          conflicts.add(task.id);
        }
      });
    });
    return conflicts;
  }, [processedTasks]);

  const { monthHeaders, dateHeaders, weekendColumns } = useMemo(() => {
    const dHeaders = [];
    const mHeaders = [];
    const wCols = [];
    let currentMonth = -1;
    let spanCount = 0;
    let monthStartDate = '';

    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

    for (let i = 0; i < totalDays; i++) {
      const dateStr = addDays(timelineRange.start, i, false);
      const d = parseUTCDate(dateStr);
      const m = d.getUTCMonth();
      const isW = isWeekend(dateStr);

      if (isW) {
        wCols.push(
          <div key={`weekend-col-${i}`} style={{ left: i * zoomLevel, width: zoomLevel }} className="absolute top-0 bottom-0 bg-gray-50/60 pointer-events-none border-r border-gray-100" />
        );
      }

      dHeaders.push(
        <div key={dateStr} style={{ width: zoomLevel }} className={`flex-shrink-0 border-r border-gray-200 text-[10px] h-6 flex items-center justify-center font-medium ${isW ? 'bg-gray-100 text-gray-300' : 'text-gray-400'}`}>
          {d.getUTCDate()}
        </div>
      );

      if (m !== currentMonth) {
        if (currentMonth !== -1) {
          mHeaders.push({ name: monthFormatter.format(parseUTCDate(monthStartDate)), span: spanCount });
        }
        currentMonth = m;
        spanCount = 1;
        monthStartDate = dateStr;
      } else {
        spanCount++;
      }
    }
    mHeaders.push({ name: monthFormatter.format(parseUTCDate(monthStartDate)), span: spanCount });

    return { 
      dateHeaders: dHeaders, 
      weekendColumns: wCols,
      monthHeaders: mHeaders.map((m, idx) => (
        <div key={`month-${idx}`} style={{ width: m.span * zoomLevel }} className="flex-shrink-0 border-r border-gray-200 bg-gray-100 h-6 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase tracking-tighter truncate px-1">
          {m.name}
        </div>
      ))
    };
  }, [totalDays, timelineRange, zoomLevel]);

  const dependencyLines = useMemo(() => {
    const lines: React.JSX.Element[] = [];
    visibleTasks.forEach(({ task }, targetIdx) => {
      task.dependencies.forEach(depId => {
        const sourceVisibleIdx = visibleTasks.findIndex(vt => vt.task.id === depId);
        if (sourceVisibleIdx !== -1) {
          const sourceTask = visibleTasks[sourceVisibleIdx].task;
          const fromX = (getDiffDays(timelineRange.start, sourceTask.endDate, false)) * zoomLevel;
          const fromY = sourceVisibleIdx * 40 + 20 + 48;
          const toX = (getDiffDays(timelineRange.start, task.startDate, false)) * zoomLevel;
          const toY = targetIdx * 40 + 20 + 48;
          
          const isConflict = task.startDate < sourceTask.endDate;
          const isSelectedDep = selectedTaskIds.includes(task.id) || selectedTaskIds.includes(depId);
          const isAnySelected = selectedTaskIds.length > 0;
          
          const midX = fromX + (toX - fromX) / 2;
          const cp1X = fromX + Math.min(20, (toX - fromX) / 4);
          const cp2X = toX - Math.min(20, (toX - fromX) / 4);
          
          const className = [
            'dependency-line-base',
            isConflict ? 'dependency-line-conflict' : '',
            isSelectedDep ? 'dependency-line-selected' : (isAnySelected ? 'dependency-line-idle' : '')
          ].filter(Boolean).join(' ');

          lines.push(
            <path 
              key={`line-${depId}-${task.id}`} 
              d={`M ${fromX} ${fromY} C ${cp1X} ${fromY}, ${cp2X} ${toY}, ${toX} ${toY}`} 
              fill="none" 
              stroke={isConflict ? "#ef4444" : isSelectedDep ? "#2563eb" : "#94a3b8"} 
              strokeWidth={isSelectedDep ? "2.5" : "1.5"} 
              markerEnd={isConflict ? "url(#arrowhead-conflict)" : isSelectedDep ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
              className={className} 
            />
          );
        }
      });
    });
    return lines;
  }, [visibleTasks, timelineRange, zoomLevel, selectedTaskIds]);

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans select-none overflow-hidden">
      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-[500px] max-w-[90vw] animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <i className="fa-solid fa-folder-plus text-2xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">Create New Project</h3>
            
            {!showUploadStep ? (
              <>
                <p className="text-slate-500 text-center mb-8 leading-relaxed">
                  Would you like to upload a file for me to pre-populate tasks? 
                  <br /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 block">Upload CSV, Text or JSON for AI processing</span>
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => setShowUploadStep(true)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-file-upload"></i> Yes, Upload File
                  </button>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleCreateProject()}
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm transition-all"
                    >
                      No, Start Blank
                    </button>
                    <button 
                      onClick={() => setIsNewProjectModalOpen(false)}
                      className="flex-1 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 rounded-2xl font-black text-sm transition-all"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div 
                  className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer group ${isParsingFile ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'}`}
                  onClick={() => !isParsingFile && fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    accept=".csv,.txt,.json,.md"
                  />
                  {isParsingFile ? (
                    <div className="flex flex-col items-center gap-4">
                      <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-600"></i>
                      <p className="text-sm font-bold text-blue-900">Gemini is reading your file...</p>
                      <p className="text-[10px] text-slate-400 font-medium">Analyzing tasks, dates and dependencies</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
                        <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                      </div>
                      <p className="text-sm font-bold text-slate-700">Click or drag & drop</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">CSV, Text, JSON or Markdown</p>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => { setShowUploadStep(false); setIsParsingFile(false); }} 
                  disabled={isParsingFile}
                  className="w-full mt-6 py-3 text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                  Go Back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {idOfProjectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-[440px] max-w-[90vw] animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Project?</h3>
            <p className="text-slate-500 text-center mb-8 leading-relaxed">
              Are you sure you want to permanently delete this project? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setIdOfProjectToDelete(null)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm transition-all"
              >
                No
              </button>
              <button 
                onClick={confirmDeleteProject}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="w-16 bg-slate-950 flex flex-col items-center py-6 shrink-0 z-50 shadow-2xl">
        <div className="mb-6 flex flex-col items-center">
           <i className="fa-solid fa-layer-group text-slate-500 text-xs mb-1"></i>
           <div className="h-[1px] w-8 bg-slate-800"></div>
        </div>
        <div className="flex flex-col gap-4 flex-1 w-full items-center overflow-y-auto no-scrollbar">
          {projects.map(p => (
            <div key={p.id} className="relative group px-2 w-full flex justify-center">
              <button
                onClick={() => { setActiveProjectId(p.id); setSelectedTaskIds([]); setIsShowingProjectSettings(false); }}
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  activeProjectId === p.id 
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.6)] ring-2 ring-blue-500 ring-offset-4 ring-offset-slate-950 scale-105' 
                    : 'bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {p.name.substring(0, 2).toUpperCase()}
              </button>
              
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIdOfProjectToDelete(p.id); 
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600 z-[60] scale-0 group-hover:scale-100 border-2 border-slate-950"
                title="Delete Project"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>

              <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-[60]">
                {p.name}
              </div>
            </div>
          ))}
          <button 
            onClick={() => setIsNewProjectModalOpen(true)}
            className="w-11 h-11 rounded-xl bg-slate-900 text-slate-600 hover:bg-slate-800 hover:text-blue-400 flex items-center justify-center transition-all border-2 border-dashed border-slate-800 hover:border-blue-500/50"
            title="Create New Project"
          >
            <i className="fa-solid fa-plus text-lg"></i>
          </button>
        </div>
        <div className="mt-auto pt-6 border-t border-slate-900 flex flex-col gap-5 items-center w-full">
           <button 
            onClick={() => { setIsShowingProjectSettings(true); setSelectedTaskIds([]); }}
            className={`transition-colors p-2 rounded-lg ${isShowingProjectSettings ? 'bg-blue-600/20 text-blue-500' : 'text-slate-600 hover:text-white'}`} 
            title="Settings"
           >
             <i className="fa-solid fa-gear text-lg"></i>
           </button>
           <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-[10px] shadow-lg ring-2 ring-blue-500/30">
             JD
           </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-40">
          <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20" onClick={() => { setSelectedTaskIds([]); setIsShowingProjectSettings(false); }}>
                <i className="fa-solid fa-calendar-week cursor-pointer"></i>
              </div>
              <div className="flex items-center gap-2 group">
                <input 
                  ref={projectNameInputRef}
                  type="text" 
                  className="font-black text-xl tracking-tight bg-transparent border-none p-0 focus:ring-0 min-w-[200px] hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                  value={activeProject?.name || ''}
                  onChange={(e) => handleUpdateProjectName(e.target.value)}
                  placeholder="Project Name"
                />
              </div>
            </div>
            <div className="h-6 w-[1px] bg-gray-200"></div>
            
            <div className="flex items-center bg-gray-100 p-1 rounded-xl shadow-inner">
              <button 
                onClick={() => setViewType('gantt')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-widest transition-all flex items-center gap-2 ${viewType === 'gantt' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <i className="fa-solid fa-chart-gantt"></i> GANTT
              </button>
              <button 
                onClick={() => setViewType('calendar')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-widest transition-all flex items-center gap-2 ${viewType === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <i className="fa-solid fa-calendar-days"></i> CALENDAR
              </button>
            </div>

            <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
            <div className="flex items-center gap-1">
              <button onClick={addTask} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center gap-2" title="New Task">
                <i className="fa-solid fa-plus"></i> New Task
              </button>
              <div className="flex items-center gap-1 ml-2">
                <button 
                  onClick={handleCopy} 
                  disabled={selectedTaskIds.length === 0}
                  className="p-2 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 transition-colors" 
                  title="Copy Selection (Ctrl+C)"
                >
                  <i className="fa-solid fa-copy"></i>
                </button>
                <button 
                  onClick={handlePaste} 
                  disabled={clipboard.length === 0}
                  className="p-2 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 transition-colors" 
                  title="Paste (Ctrl+V)"
                >
                  <i className="fa-solid fa-paste"></i>
                </button>
              </div>
              <button 
                onClick={deleteSelected} 
                disabled={selectedTaskIds.length === 0} 
                className="p-2 hover:bg-red-50 hover:text-red-600 rounded text-gray-400 disabled:opacity-30 transition-colors" 
                title="Delete Selected Tasks (Del)"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
<button onClick={outdentTask} disabled={!selectedTaskIds} className="p-2 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30 transition-colors" title="Outdent">
                <i className="fa-solid fa-outdent"></i>
              </button>
              <button onClick={indentTask} disabled={!selectedTaskIds} className="p-2 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30 transition-colors" title="Indent">
                <i className="fa-solid fa-indent"></i>
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative w-64 ai-input-container">
              <input 
                type="text" 
                placeholder="Ask AI to refine..." 
                className="w-full bg-gray-100 border-none rounded-xl py-2 pl-4 pr-10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner" 
                value={promptValue} 
                onChange={e => setPromptValue(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAiGeneration()} 
              />
              <button onClick={handleAiGeneration} disabled={isGenerating} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 disabled:opacity-50">
                {isGenerating ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>}
              </button>
            </div>
            

           <button
           onClick={() => setIsShareModalOpen(true)}
           className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md"
>
<i className="fa-solid fa-share-nodes"></i> SHARE
</button>

            <div className="relative" ref={exportDropdownRef}>
              <button 
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                EXPORT <i className="fa-solid fa-download"></i>
              </button>
              {isExportOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 shadow-2xl rounded-xl p-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                  <button onClick={() => exportData('pdf')} className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg flex items-center gap-3 transition-colors">
                    <i className="fa-solid fa-file-pdf text-red-500"></i> PDF Document
                  </button>
                  <button onClick={() => exportData('csv')} className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg flex items-center gap-3 transition-colors">
                    <i className="fa-solid fa-file-csv text-blue-500"></i> CSV Spreadsheet
                  </button>
                </div>
              )}
            </div>

            {viewType === 'gantt' && (
              <div className="flex items-center gap-2 text-gray-500 bg-gray-100 rounded-xl p-1 shadow-inner">
                <button onClick={() => setZoomLevel(Math.max(20, zoomLevel - 10))} className="w-8 h-8 hover:bg-white hover:shadow-sm rounded-lg flex items-center justify-center transition-all"><i className="fa-solid fa-minus text-[10px]"></i></button>
                <span className="text-[9px] font-black w-10 text-center tracking-tighter">{Math.round((zoomLevel / 40) * 100)}%</span>
                <button onClick={() => setZoomLevel(Math.min(100, zoomLevel + 10))} className="w-8 h-8 hover:bg-white hover:shadow-sm rounded-lg flex items-center justify-center transition-all"><i className="fa-solid fa-plus text-[10px]"></i></button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden gantt-container">
          {viewType === 'gantt' ? (
            <>
              <div className="w-[640px] border-r border-gray-200 flex flex-col bg-white task-list-container">
                <div className="h-12 sticky top-0 border-b border-gray-200 bg-gray-50/50 flex items-center px-4 font-black text-[10px] text-gray-500 uppercase tracking-[0.15em] z-40">
                  <div className="w-8 text-center pr-2">ID</div>
                  <div className="flex-1 px-4 border-l border-gray-100">Task Details</div>
                  <div className="w-20 text-center border-l border-gray-100">Duration</div>
                  <div className="w-28 text-center border-l border-gray-100">Assignee</div>
                  <div className="w-10 text-center border-l border-gray-100">Done</div>
                  <div className="w-10"></div>
                </div>
                <div ref={tableRef} className="flex-1 overflow-y-auto no-scrollbar" onScroll={handleScroll}>
                  {visibleTasks.map(({ task, originalIndex }, visibleIdx) => {
                    const hasChildren = isParent(originalIndex);
                    const hasConflict = conflictedTaskIds.has(task.id);
                    const isOverdue = overdueTaskIds.has(task.id);
                    const isSelected = selectedTaskIds.includes(task.id);
                    const isBeingDragged = draggedRowIndex === originalIndex;
                    
                    return (
                      <div 
                        key={task.id} 
                        draggable={true}
                        onDragStart={(e) => handleTaskDragStart(e, originalIndex)}
                        onDragOver={(e) => handleTaskDragOver(e, originalIndex)}
                        onDragEnd={handleTaskDragEnd}
                        onClick={(e) => handleSelectTask(e, task.id, originalIndex)} 
                        className={`group h-10 border-b border-gray-50 flex items-center cursor-pointer transition-all duration-200 ${
                          isSelected ? 'bg-blue-50/70 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]' : 'hover:bg-gray-50/50'
                        } ${hasConflict ? 'bg-red-50/30' : ''} ${isOverdue ? 'bg-amber-50/30' : ''} ${isBeingDragged ? 'opacity-40 grayscale' : ''}`}
                      >
                        <div className="w-5 flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity pl-1">
                          <i className="fa-solid fa-grip-vertical text-[10px]"></i>
                        </div>
                        <div className={`w-1 h-full transition-all duration-300 ${isSelected ? 'bg-blue-600 scale-y-100' : 'bg-transparent scale-y-0'}`}></div>
                        <div className="w-7 text-[10px] text-gray-400 font-black text-center pr-2">{originalIndex + 1}</div>
                        <div className="flex-1 px-2 overflow-hidden flex items-center" style={{ paddingLeft: `${task.level * 24 + 4}px` }}>
                          {hasChildren && <button onClick={(e) => { e.stopPropagation(); handleUpdateTask(task.id, { isCollapsed: !task.isCollapsed }); }} className="mr-2 text-gray-400 hover:text-gray-600 transition-transform duration-200" style={{ transform: task.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}><i className="fa-solid fa-chevron-down text-[10px]"></i></button>}
                          {!hasChildren && <div className="w-4 mr-2"></div>}
                          <div className="flex-1 flex items-center gap-2 overflow-hidden">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: task.color || (hasChildren ? '#0f172a' : '#3b82f6') }}></div>
                            <input type="text" value={task.name} readOnly={hasChildren} onChange={(e) => handleUpdateTask(task.id, { name: e.target.value })} className={`w-full bg-transparent border-none text-[13px] font-medium focus:ring-0 truncate ${hasChildren ? 'font-bold cursor-default' : ''} ${isSelected ? 'text-blue-900' : 'text-slate-800'}`} />
                            <div className="flex items-center gap-1.5 shrink-0 ml-auto mr-2">
                              {isOverdue && !hasChildren && <span className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded flex items-center gap-1"><i className="fa-solid fa-clock-rotate-left"></i> LATE</span>}
                              {hasConflict && !hasChildren && <i className="fa-solid fa-triangle-exclamation text-[10px] text-red-500 flex-shrink-0 animate-pulse" title="Dependency Conflict"></i>}
                            </div>
                          </div>
                        </div>
                        <div className="w-20 text-center">
                          <input type="number" step="1" value={task.duration} readOnly={hasChildren} onChange={(e) => handleUpdateTask(task.id, { duration: parseInt(e.target.value) || 0 })} className={`w-10 text-center bg-transparent border-none text-[12px] font-bold focus:ring-0 ${hasChildren ? 'text-slate-900' : 'text-slate-600'}`} />
                          <span className="text-[10px] font-bold text-gray-300">d</span>
                        </div>
                        <div className="w-28 text-center px-2">
                          <input type="text" placeholder="Unassigned" value={task.assignee || ''} onChange={(e) => handleUpdateTask(task.id, { assignee: e.target.value })} className="w-full bg-transparent border-none text-[11px] font-medium text-gray-600 focus:ring-0 text-center italic placeholder:text-gray-300" />
                        </div>
                        <div className="w-10 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={task.progress === 100}
                            onChange={(e) => handleUpdateTask(task.id, { progress: e.target.checked ? 100 : 0 })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            disabled={hasChildren}
                          />
                        </div>
                        <div className="w-10 flex items-center justify-center">
                          {task.attachments.length > 0 && <i className="fa-solid fa-paperclip text-[10px] text-blue-500 bg-blue-50 p-1 rounded-md"></i>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="h-40"></div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative gantt-chart-container">
                <div ref={gridRef} className="flex-1 overflow-auto bg-white" onScroll={handleScroll}>
                  <div className="relative gantt-grid" style={{ width: totalDays * zoomLevel, height: visibleTasks.length * 40 + 200, backgroundImage: `linear-gradient(to right, #f3f4f6 1px, transparent 1px), linear-gradient(to bottom, #f3f4f6 1px, transparent 1px)`, backgroundSize: `${zoomLevel}px 40px` }}>
                    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 flex flex-col shadow-sm" style={{ width: totalDays * zoomLevel }}>
                      <div className="flex h-6">{monthHeaders}</div>
                      <div className="flex h-6">{dateHeaders}</div>
                    </div>

                    {weekendColumns}

                    {visibleTasks.map(({ task }, idx) => {
                      if (!selectedTaskIds.includes(task.id)) return null;
                      return <div key={`row-highlight-${task.id}`} className="absolute left-0 right-0 h-10 row-highlight-active pointer-events-none" style={{ top: idx * 40 + 48 }}></div>;
                    })}

                    <div className="absolute top-0 bottom-0 w-[2px] bg-red-500/60 pointer-events-none z-20 shadow-[0_0_12px_rgba(239,68,68,0.2)]" style={{ left: todayLeft - 1 }}>
                      <div className="sticky top-[48px] bg-red-500 text-[8px] text-white px-2 py-0.5 rounded-b font-black tracking-tighter shadow-lg flex items-center justify-center -translate-x-1/2">TODAY</div>
                    </div>

                    <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }}>
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
                          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#94a3b8" />
                        </marker>
                        <marker id="arrowhead-selected" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
                          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#2563eb" />
                        </marker>
                        <marker id="arrowhead-conflict" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
                          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#ef4444" />
                        </marker>
                      </defs>
                      {dependencyLines}
                    </svg>

                    {visibleTasks.map(({ task }, idx) => {
                      const dayOffset = getDiffDays(timelineRange.start, task.startDate, false);
                      const totalCalDays = getDiffDays(task.startDate, task.endDate, false) + 1;
                      const width = totalCalDays * zoomLevel;
                      const top = idx * 40 + 10 + 48;
                      const originalIndex = visibleTasks[idx].originalIndex;
                      const hasChildren = isParent(originalIndex);
                      const hasConflict = conflictedTaskIds.has(task.id);
                      const isOverdue = overdueTaskIds.has(task.id);
                      const isSelected = selectedTaskIds.includes(task.id);
                      
                      const barColor = task.color || '#3b82f6';
                      const summaryColor = task.color || '#0f172a';

                      return (
                        <div key={task.id} className={`absolute group transition-all duration-300 ${isSelected ? 'task-bar-selected' : ''} ${isOverdue ? 'task-bar-overdue' : ''}`} style={{ left: dayOffset * zoomLevel, top, width: Math.max(width, 4), height: 20 }} onClick={(e) => handleSelectTask(e, task.id, originalIndex)}>
                          {hasChildren ? (
                            <div className="relative w-full h-full">
                              <div className={`absolute top-0 left-0 right-0 h-2 rounded-sm transition-all shadow-md ${isSelected ? 'ring-2 ring-blue-500' : ''} ${hasConflict ? 'ring-2 ring-red-500' : ''}`} style={{ backgroundColor: summaryColor }}></div>
                              <div className={`absolute top-0 left-0 w-[2.5px] h-4 transition-colors`} style={{ backgroundColor: summaryColor }}></div>
                              <div className={`absolute top-0 right-0 w-[2.5px] h-4 transition-colors`} style={{ backgroundColor: summaryColor }}></div>
                              <div className={`absolute top-0 left-0 border-t-[8px] border-r-[8px] border-r-transparent transition-colors`} style={{ borderTopColor: summaryColor }}></div>
                              <div className={`absolute top-0 right-0 border-t-[8px] border-l-[8px] border-l-transparent transition-colors`} style={{ borderTopColor: summaryColor }}></div>
                            </div>
                          ) : (
                            <div 
                              onMouseDown={(e) => handleBarMouseDown(e, task, 'move')} 
                              className={`absolute inset-0 rounded-md shadow-sm transition-all cursor-move ring-offset-2 ${isSelected ? 'ring-2 ring-blue-500 shadow-xl' : ''} ${hasConflict ? 'ring-2 ring-red-500' : ''} ${isOverdue ? 'border-2 border-amber-500' : ''}`}
                              style={{ backgroundColor: hasConflict ? '#fee2e2' : (isOverdue ? '#fffbeb' : barColor) }}
                            >
                              <div className={`h-full rounded-l-md transition-all ${isSelected ? 'bg-white/30' : (isOverdue ? 'bg-amber-400/40' : 'bg-black/10')}`} style={{ width: `${task.progress}%` }}></div>
                              <div onMouseDown={(e) => handleBarMouseDown(e, task, 'resize')} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/20 transition-colors rounded-r-md"></div>
                            </div>
                          )}
                          <div className={`absolute left-full ml-4 top-1/2 -translate-y-1/2 text-[11px] whitespace-nowrap pointer-events-none transition-all duration-300 flex items-center gap-2 ${isSelected ? 'opacity-100 font-black scale-105 text-blue-700 bg-white shadow-xl px-2.5 py-1 rounded-lg border border-blue-100' : 'opacity-0 group-hover:opacity-100 text-gray-500 bg-white/80 px-2 rounded-md translate-x-2'}`}>
                            {hasConflict && <i className="fa-solid fa-triangle-exclamation text-red-500"></i>}
                            {isOverdue && !hasChildren && <span className="text-amber-600 font-black uppercase tracking-tighter text-[9px] flex items-center gap-1"><i className="fa-solid fa-clock-rotate-left"></i> OVERDUE</span>}
                            <span>{task.name} {task.assignee ? `• ${task.assignee}` : ''} ({task.duration} d)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <CalendarView 
              tasks={tasks} 
              selectedTaskId={selectedTaskIds.length > 0 ? selectedTaskIds[selectedTaskIds.length - 1] : null} 
              onSelectTask={(id) => { setSelectedTaskIds([id]); setIsShowingProjectSettings(false); }} 
              now={now} 
            />
          )}
        </div>
        
        <footer className="h-10 border-t border-gray-200 flex items-center px-6 bg-white text-[10px] font-bold text-gray-400 justify-between shrink-0 z-40">
          <div className="flex gap-6 items-center">
            <span className="text-gray-900">{tasks.length} <span className="text-gray-400 font-medium">TASKS</span></span>
            <div className="w-[1px] h-3 bg-gray-200"></div>
            <span className="text-emerald-600">{tasks.filter(t => t.progress === 100).length} <span className="text-gray-400 font-medium uppercase tracking-tighter">Completed</span></span>
            {overdueTaskIds.size > 0 && <span className="text-amber-600 flex items-center gap-1"><i className="fa-solid fa-clock-rotate-left"></i> {overdueTaskIds.size} OVERDUE</span>}
            {conflictedTaskIds.size > 0 && <span className="text-red-500 flex items-center gap-1"><i className="fa-solid fa-triangle-exclamation"></i> {conflictedTaskIds.size} CRITICAL CONFLICTS</span>}
            {selectedTaskIds.length > 0 && (
              <>
                <div className="w-[1px] h-3 bg-gray-200"></div>
                <span className="text-blue-600 font-black tracking-widest uppercase">{selectedTaskIds.length} SELECTED</span>
              </>
            )}
            <div className="w-[1px] h-3 bg-gray-200"></div>
            <span className="flex items-center gap-1.5"><i className="fa-solid fa-business-time"></i> WORK DAYS: M-F</span>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500 shadow-sm"></div> PLANNED</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-400 ring-1 ring-amber-500 shadow-sm"></div> OVERDUE</span>
            <span className="flex items-center gap-1.5 ml-2"><div className="w-4 h-2.5 rounded-sm bg-slate-900 shadow-sm"></div> SUMMARY</span>
          </div>

{activeProject && (
<ShareModal
isOpen={isShareModalOpen}
onClose={() => setIsShareModalOpen(false)}
projectId={activeProject.id}
projectName={activeProject.name}
members={activeProject.members ||[]}
isOwner={true}
/>
)}
        </footer>
        <div className="sidebar-container">
          <Sidebar 
            task={selectedTask} 
            isShowingProjectSettings={isShowingProjectSettings}
            activeProject={activeProject} 
            allTasks={tasks} 
            onClose={() => { setSelectedTaskIds([]); setIsShowingProjectSettings(false); }} 
            onUpdateTask={(updates) => selectedTaskIds.length > 0 && handleUpdateTask(selectedTaskIds[selectedTaskIds.length - 1], updates)} 
            onDeleteProject={() => setIdOfProjectToDelete(activeProject.id)}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
