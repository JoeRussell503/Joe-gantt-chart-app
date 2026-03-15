—import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { doc, getDoc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';

interface InviteAcceptProps {
  inviteCode: string;
  onAccepted: () => void;
}

const InviteAccept: React.FC<InviteAcceptProps> = ({ inviteCode, onAccepted }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'done' | 'error' | 'expired'>('loading');
  const [invite, setInvite] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadInvite();
  }, [inviteCode]);

  const loadInvite = async () => {
    try {
      const inviteDoc = await getDoc(doc(db, 'invites', inviteCode));
      if (!inviteDoc.exists()) {
        setStatus('error');
        setErrorMsg('This invite link is invalid or has expired.');
        return;
      }
      const data = inviteDoc.data();
      if (data.used) {
        setStatus('expired');
        return;
      }
      if (new Date(data.expiresAt) < new Date()) {
        setStatus('expired');
        return;
      }
      setInvite(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMsg('Could not load invite. Please try again.');
    }
  };

  const acceptInvite = async () => {
    if (!auth.currentUser || !invite) return;
    setStatus('accepting');
    try {
      const user = auth.currentUser;

      // Get the owner's workspace to find the project
      const ownerWorkspace = await getDoc(doc(db, 'workspaces', invite.fromUid));
      if (!ownerWorkspace.exists()) throw new Error('Project not found');

      const ownerData = ownerWorkspace.data();
      const project = ownerData.projects?.find((p: any) => p.id === invite.projectId);
      if (!project) throw new Error('Project not found in workspace');

      // Add project to this user's workspace
      const myWorkspaceRef = doc(db, 'workspaces', user.uid);
      const myWorkspace = await getDoc(myWorkspaceRef);

      if (myWorkspace.exists()) {
        const myData = myWorkspace.data();
        const alreadyHas = myData.projects?.some((p: any) => p.id === invite.projectId);
        if (!alreadyHas) {
          // Add project with role metadata
          const projectWithRole = { ...project, _sharedFrom: invite.fromUid, _role: invite.role };
          await updateDoc(myWorkspaceRef, {
            projects: arrayUnion(projectWithRole),
          });
        }
      } else {
        // Create workspace with this project
        await setDoc(myWorkspaceRef, {
          projects: [{ ...project, _sharedFrom: invite.fromUid, _role: invite.role }],
          activeProjectId: invite.projectId,
          ownerEmail: user.email,
          updatedAt: new Date().toISOString(),
        });
      }

      // Mark invite as used
      await updateDoc(doc(db, 'invites', inviteCode), { used: true, usedBy: user.email, usedAt: new Date().toISOString() });

      setStatus('done');
      setTimeout(() => onAccepted(), 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to accept invite. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
        
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-blue-600/20">
          <i className="fa-solid fa-chart-gantt text-white text-2xl"></i>
        </div>

        {status === 'loading' && (
          <>
            <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-600 mb-4"></i>
            <p className="text-slate-500">Loading invite...</p>
          </>
        )}

        {status === 'ready' && invite && (
          <>
            <h1 className="text-2xl font-black text-slate-900 mb-2">You're Invited!</h1>
            <p className="text-slate-500 mb-6">
              <strong>{invite.fromEmail}</strong> has invited you to collaborate on
            </p>
            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <p className="text-lg font-black text-slate-900">{invite.projectName}</p>
              <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                invite.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
              }`}>
                <i className={`fa-solid ${invite.role === 'editor' ? 'fa-pen-to-square' : 'fa-eye'}`}></i>
                {invite.role === 'editor' ? 'Can Edit' : 'Can View'}
              </span>
            </div>

            {auth.currentUser ? (
              <button
                onClick={acceptInvite}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
              >
                Accept & Open Project
              </button>
            ) : (
              <div>
                <p className="text-sm text-slate-500 mb-4">Sign in or create an account to accept this invite.</p>
                <a
                  href="/"
                  className="w-full inline-block py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
                >
                  Sign In / Sign Up
                </a>
              </div>
            )}
          </>
        )}

        {status === 'accepting' && (
          <>
            <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-600 mb-4"></i>
            <p className="text-slate-500">Adding project to your workspace...</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-check text-2xl"></i>
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">You're in!</h2>
            <p className="text-slate-500">Opening your project...</p>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-clock text-2xl"></i>
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Invite Expired</h2>
            <p className="text-slate-500">This invite link has already been used or has expired. Ask the project owner to send a new one.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-500 mb-4">{errorMsg}</p>
            <a href="/" className="text-blue-600 text-sm font-bold hover:underline">Go to app</a>
          </>
        )}

      </div>
    </div>
  );
};

export default InviteAccept;
