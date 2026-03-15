import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { db, auth } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  members: any[];
  isOwner: boolean;
  project?: any;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen, onClose, projectId, projectName, project
}) => {
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setInviteLink('');
      setCopied(false);
    }
  }, [isOpen]);

  const generateAndCopy = async () => {
    if (!auth.currentUser) return;
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    }
    setGenerating(true);
    try {
      const inviteId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Embed the full project snapshot so the invitee doesn't need to read owner's workspace
      await setDoc(doc(db, 'invites', inviteId), {
        projectId,
        projectName,
        projectSnapshot: project || null,
        role,
        fromUid: auth.currentUser.uid,
        fromEmail: auth.currentUser.email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used: false,
      });

      const link = window.location.origin + '/invite/' + inviteId;
      setInviteLink(link);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Invite error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-[480px] max-w-[90vw]">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">Share Project</h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[300px]">{projectName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Permission level</label>
          <div className="flex gap-3">
            <button
              onClick={() => { setRole('editor'); setInviteLink(''); }}
              className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${role === 'editor' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <i className="fa-solid fa-pen-to-square mr-2"></i>Can Edit
            </button>
            <button
              onClick={() => { setRole('viewer'); setInviteLink(''); }}
              className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${role === 'viewer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <i className="fa-solid fa-eye mr-2"></i>Can View
            </button>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-link text-blue-600 text-sm"></i>
            <span className="text-sm font-bold text-slate-700">Invite Link</span>
            <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
              {role === 'editor' ? 'Can Edit' : 'Can View'} · 7 days
            </span>
          </div>

          {inviteLink && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-600 font-mono truncate"
              />
            </div>
          )}

          <button
            onClick={generateAndCopy}
            disabled={generating}
            className={`w-full py-3 rounded-2xl text-sm font-black transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${copied ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'}`}
          >
            {generating ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
            ) : copied ? (
              <><i className="fa-solid fa-check"></i> Copied to clipboard!</>
            ) : inviteLink ? (
              <><i className="fa-solid fa-copy"></i> Copy Link Again</>
            ) : (
              <><i className="fa-solid fa-link"></i> Generate &amp; Copy Invite Link</>
            )}
          </button>

          {inviteLink && (
            <button
              onClick={() => { setInviteLink(''); setCopied(false); }}
              className="w-full mt-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Generate new link with different permission
            </button>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-2">
          {[
            { icon: 'fa-copy', text: 'Copy and send the link to your teammate' },
            { icon: 'fa-user-plus', text: 'They sign up at ganttbyjoe.netlify.app' },
            { icon: 'fa-check-circle', text: 'They open the link — project added instantly' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-slate-500">
              <div className="w-6 h-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${s.icon} text-[10px]`}></i>
              </div>
              {s.text}
            </div>
          ))}
        </div>

      </div>
    </div>
  );

  return isOpen ? ReactDOM.createPortal(modalContent, document.body) : null;
};

export default ShareModal;
