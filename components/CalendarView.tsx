
import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { parseUTCDate, toUTCDateString, isWorkDay } from '../utils/dateUtils';

interface CalendarViewProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  now: Date;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, selectedTaskId, onSelectTask, now }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(now);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
  });

  const year = currentMonth.getUTCFullYear();
  const month = currentMonth.getUTCMonth();

  const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const todayStr = toUTCDateString(now);

  const prevMonth = () => setCurrentMonth(new Date(Date.UTC(year, month - 1, 1)));
  const nextMonth = () => setCurrentMonth(new Date(Date.UTC(year, month + 1, 1)));
  const goToToday = () => {
    const d = new Date(now);
    setCurrentMonth(new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)));
  };

  const calendarDays = useMemo(() => {
    const days: string[] = [];
    const prevMonthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    
    // Previous month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push(toUTCDateString(new Date(Date.UTC(year, month - 1, prevMonthLastDay - i))));
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(toUTCDateString(new Date(Date.UTC(year, month, i))));
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(toUTCDateString(new Date(Date.UTC(year, month + 1, i))));
    }
    return days;
  }, [year, month, firstDayOfMonth, daysInMonth]);

  // Group tasks by date for the calendar
  const getTasksForDay = (dateStr: string) => {
    return tasks.filter(t => t.startDate <= dateStr && t.endDate >= dateStr);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-500">
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </h2>
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-50 text-slate-500 border-r border-slate-100 transition-colors">
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <button onClick={goToToday} className="px-3 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 uppercase tracking-widest transition-colors">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-50 text-slate-500 transition-colors">
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Overdue</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-7 border-l border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="h-8 bg-gray-50 border-b border-r border-gray-200 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
            {d}
          </div>
        ))}
        {calendarDays.map((dateStr, idx) => {
          const isCurrentMonth = dateStr.startsWith(toUTCDateString(currentMonth).substring(0, 7));
          const isToday = dateStr === todayStr;
          const isWknd = !isWorkDay(dateStr);
          // Only fetch tasks if it's a working day
          const dayTasks = isWknd ? [] : getTasksForDay(dateStr);

          return (
            <div 
              key={`${dateStr}-${idx}`} 
              className={`min-h-[140px] border-b border-r border-gray-200 p-2 flex flex-col gap-1.5 transition-colors ${!isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'} ${isWknd ? 'bg-slate-50/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                  isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110' : 
                  isCurrentMonth ? 'text-slate-900' : 'text-slate-300'
                }`}>
                  {parseUTCDate(dateStr).getUTCDate()}
                </span>
                {!isWknd && isCurrentMonth && <div className="w-1 h-1 rounded-full bg-slate-200"></div>}
              </div>
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                {dayTasks.map(t => {
                  const isOverdue = t.endDate < todayStr && t.progress < 100;
                  const isSelected = selectedTaskId === t.id;
                  const color = t.color || '#3b82f6';

                  return (
                    <div 
                      key={t.id} 
                      onClick={(e) => { e.stopPropagation(); onSelectTask(t.id); }}
                      className={`h-6 px-1.5 rounded-md text-[9px] font-bold truncate flex items-center cursor-pointer transition-all border shadow-sm ${
                        isSelected ? 'ring-2 ring-blue-500 z-20 scale-[1.02]' : 'hover:scale-[1.01]'
                      } ${isOverdue ? 'bg-amber-50 text-amber-700 border-amber-200' : 'text-white'}`}
                      style={{ 
                        backgroundColor: isOverdue ? undefined : color,
                        borderColor: isOverdue ? undefined : 'rgba(0,0,0,0.05)',
                        opacity: isCurrentMonth ? 1 : 0.4
                      }}
                      title={`${t.name} (${t.duration}d)`}
                    >
                      <div className="flex items-center gap-1 overflow-hidden w-full">
                        {isOverdue && <i className="fa-solid fa-clock-rotate-left shrink-0"></i>}
                        <span className="truncate flex-1">{t.name}</span>
                        {t.progress === 100 && <i className="fa-solid fa-circle-check shrink-0"></i>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;
