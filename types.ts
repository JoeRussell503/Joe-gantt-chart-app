
export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'file' | 'link';
  createdAt: string;
}

export interface Task {
  id: string;
  name: string;
  startDate: string; // ISO format
  duration: number; // days
  endDate: string; // ISO format
  progress: number; // 0-100
  dependencies: string[]; // List of task IDs
  attachments: Attachment[];
  assignee?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  level: number; // Indentation level (0 is root)
  isCollapsed?: boolean;
  color?: string; // Hex color code
}

export interface ProjectMember {
  uid: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  displayName: string;
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
  createdAt: string;
  updatedAt?: string;
  owner?: string;
  members?: ProjectMember[];
}

export interface ProjectState {
  projects: Project[];
  activeProjectId: string;
  viewMode: 'days' | 'weeks' | 'months';
  zoom: number;
}
