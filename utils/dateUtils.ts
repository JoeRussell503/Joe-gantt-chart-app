
export const PROJECT_CONFIG = {
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  hoursPerDay: 8,
};

/**
 * Parses a YYYY-MM-DD string into a UTC Date object at midnight.
 */
export const parseUTCDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/**
 * Returns YYYY-MM-DD string for a Date object in UTC.
 */
export const toUTCDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const isWorkDay = (dateStr: string): boolean => {
  const date = parseUTCDate(dateStr);
  const day = date.getUTCDay();
  return PROJECT_CONFIG.workingDays.includes(day);
};

export const isWeekend = (dateStr: string): boolean => {
  return !isWorkDay(dateStr);
};

/**
 * Adds a number of working days to a start date.
 * Smartsheet logic: Duration 1 means start and end on the same day.
 */
export const addDays = (dateStr: string, days: number, workDaysOnly: boolean = false): string => {
  const date = parseUTCDate(dateStr);
  
  if (!workDaysOnly) {
    date.setUTCDate(date.getUTCDate() + Math.floor(days));
    return toUTCDateString(date);
  }

  let remainingDays = Math.max(1, Math.floor(days));
  // If duration is 1, it starts and ends on the same day.
  if (remainingDays === 1) return dateStr;

  // Subtract the first day (which is the current day)
  remainingDays -= 1;

  while (remainingDays > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isWorkDay(toUTCDateString(date))) {
      remainingDays -= 1;
    }
  }

  return toUTCDateString(date);
};

/**
 * Calculates the difference in physical days between two dates.
 */
export const getDiffDays = (start: string, end: string, workDaysOnly: boolean = false): number => {
  const s = parseUTCDate(start);
  const e = parseUTCDate(end);
  
  if (e < s) return 0;

  if (!workDaysOnly) {
    const diffTime = e.getTime() - s.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  let count = 0;
  let cur = parseUTCDate(start);
  const endStr = end;
  
  while (toUTCDateString(cur) <= endStr) {
    if (isWorkDay(toUTCDateString(cur))) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  
  return count;
};

export const formatDate = (dateStr: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parseUTCDate(dateStr));
};

export const getTimelineRange = (tasks: any[]) => {
  const todayStr = toUTCDateString(new Date());
  if (tasks.length === 0) {
    return { start: todayStr, end: addDays(todayStr, 30) };
  }
  
  let min = tasks[0].startDate;
  let max = tasks[0].endDate;
  
  tasks.forEach(t => {
    if (t.startDate < min) min = t.startDate;
    if (t.endDate > max) max = t.endDate;
  });

  // Start on a Monday for cleaner look
  const minDate = parseUTCDate(min);
  const day = minDate.getUTCDay();
  // Adjust to previous Monday
  const diffToMonday = day === 0 ? 6 : day - 1;
  minDate.setUTCDate(minDate.getUTCDate() - diffToMonday - 7);

  return {
    start: toUTCDateString(minDate),
    end: addDays(max, 14, false)
  };
};
