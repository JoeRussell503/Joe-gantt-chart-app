import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Project, Task } from '../types';

// Collection references
const projectsCollection = collection(db, 'projects');
const usersCollection = collection(db, 'users');

// Create a new project
export const createProject = async (name: string, tasks: Task[] = []): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const project: Project = {
    id: projectId,
    name,
    tasks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: user.uid,
    members: {
      [user.uid]: {
        uid: user.uid,
        email: user.email || '',
        role: 'owner',
        displayName: user.displayName || user.email || 'Unknown'
      }
    }
  };

  await setDoc(doc(projectsCollection, projectId), {
    ...project,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });

  return projectId;
};

// Get all projects for current user
export const getUserProjects = async (): Promise<Project[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  // Query all projects and filter on client side
  const snapshot = await getDocs(projectsCollection);
  
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      } as Project;
    })
    .filter(project => {
      const members = project.members || {};
      return user.uid in members;
    });
};

// Subscribe to real-time project updates
export const subscribeToProject = (
  projectId: string, 
  callback: (project: Project | null) => void
): (() => void) => {
  const projectDoc = doc(projectsCollection, projectId);
  
  return onSnapshot(projectDoc, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback({
        ...data,
        id: snapshot.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      } as Project);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error subscribing to project:', error);
    callback(null);
  });
};

// Update project tasks
export const updateProjectTasks = async (projectId: string, tasks: Task[]): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const projectDoc = doc(projectsCollection, projectId);
  await updateDoc(projectDoc, {
    tasks,
    updatedAt: Timestamp.now()
  });
};

// Update project name
export const updateProjectName = async (projectId: string, name: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const projectDoc = doc(projectsCollection, projectId);
  await updateDoc(projectDoc, {
    name,
    updatedAt: Timestamp.now()
  });
};

// Delete project
export const deleteProject = async (projectId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const projectDoc = doc(projectsCollection, projectId);
  await deleteDoc(projectDoc);
};

// Share project with another user
export const shareProject = async (
  projectId: string, 
  email: string, 
  role: 'editor' | 'viewer'
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const projectDoc = doc(projectsCollection, projectId);
  const projectSnap = await getDoc(projectDoc);
  
  if (!projectSnap.exists()) throw new Error('Project not found');
  
  const projectData = projectSnap.data();
  if (projectData.owner !== user.uid) {
    throw new Error('Only the owner can share this project');
  }

  const members = projectData.members || {};
  const existingMember = Object.values(members).find((m: any) => m.email === email);
  if (existingMember) {
    throw new Error('User already has access');
  }

  const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await updateDoc(projectDoc, {
    [`members.${memberId}`]: {
      email,
      role,
      uid: '',
      displayName: email.split('@')[0]
    },
    updatedAt: Timestamp.now()
  });
};

// Remove member from project
export const removeMember = async (projectId: string, memberEmail: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const projectDoc = doc(projectsCollection, projectId);
  const projectSnap = await getDoc(projectDoc);
  
  if (!projectSnap.exists()) throw new Error('Project not found');
  
  const projectData = projectSnap.data();
  if (projectData.owner !== user.uid) {
    throw new Error('Only the owner can remove members');
  }

  const members = projectData.members || {};
  const memberKey = Object.keys(members).find(key => members[key].email === memberEmail);
  
  if (!memberKey) throw new Error('Member not found');

  await updateDoc(projectDoc, {
    [`members.${memberKey}`]: deleteField(),
    updatedAt: Timestamp.now()
  });
};

// Get user's role in a project
export const getUserRole = async (projectId: string): Promise<'owner' | 'editor' | 'viewer' | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const projectDoc = doc(projectsCollection, projectId);
  const projectSnap = await getDoc(projectDoc);
  
  if (!projectSnap.exists()) return null;
  
  const projectData = projectSnap.data();
  const members = projectData.members || {};
  const member = Object.values(members).find((m: any) => 
    m.uid === user.uid || m.email === user.email
  );

  return member?.role || null;
};

// Import from localStorage
export const importFromLocalStorage = async (): Promise<string[]> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const STORAGE_KEY = 'gemini-gantt-workspace-v2';
  const saved = localStorage.getItem(STORAGE_KEY);
  
  if (!saved) throw new Error('No local data found');

  const data = JSON.parse(saved);
  const localProjects = data.projects || [];
  
  const importedIds: string[] = [];

  for (const localProject of localProjects) {
    const projectId = await createProject(
      `${localProject.name} (Imported)`,
      localProject.tasks || []
    );
    importedIds.push(projectId);
  }

  return importedIds;
};