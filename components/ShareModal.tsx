import React, { useState } from 'react';
import { db, auth } from '../config/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  members: any[];
  isOwner: boolean;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen, onClose, projectId, projectName, members, isOwner
}) => {
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  if (!isOpen) return null;

  const generateInviteLink = async () => {
    if (!auth.currentUser) return;
    setGenerating(true);
    try {
      // Create a unique invite code
      const inviteId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Save the invite to Firestore
      await setDoc(doc(db, 'invites', inviteId), {
        projectId,
        projectName,
        role,
        fromUid: auth.currentUser.uid,
        fromEmail: auth.currentUser.email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        used: false,
      });

      const link = `${window.location.origin}/invite/${inviteId}`;
      setInviteLink(link);
    } catch (err) {
      console.error('Error generating invite:', err);
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleGenerateAndCopy = async () => {
    if (inviteLink) {
      copyLink();
    } else {
      await generateInviteLink();
    }
  };

  // Auto-copy once link is generated
  React.useEffect(() => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  }, [inviteLink]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-[480px] max-w-[90vw] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">Share Project</h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[300px]">{projectName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Permission selector */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Invite with permission
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => { setRole('editor'); setInviteLink(''); }}
              className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                role === 'editor'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <i className="fa-solid fa-pen-to-square mr-2"></i>Can Edit
            </button>
            <button
              onClick={() => { setRole('viewer'); setInviteLink(''); }}
              className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                role === 'viewer'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <i className="fa-solid fa-eye mr-2"></i>Can View
            </button>
          </div>
        </div>

        {/* Invite link section */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-link text-blue-600 text-sm"></i>
            <span className="text-sm font-bold text-slate-700">Invite Link</span>
            <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
              {role === 'editor' ? 'Can Edit' : 'Can View'} · 7 days
            </span>
          </div>

          {inviteLink ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-600 font-mono truncate"
              />
              <button
                onClick={copyLink}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? <><i className="fa-solid fa-check mr-1"></i>Copied!</> : <><i className="fa-solid fa-copy mr-1"></i>Copy</>}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-3">
              Generate a link and share it with your teammate. Anyone with the link can join as <strong>{role === 'editor' ? 'an editor' : 'a viewer'}</strong>.
            </p>
          )}

          {!inviteLink && (
            <button
              onClick={handleGenerateAndCopy}
              disabled={generating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
              ) : (
                <><i className="fa-solid fa-link"></i> Generate &amp; Copy Invite Link</>
              )}
            </button>
          )}

          {inviteLink && (
            <button
              onClick={() => { setInviteLink(''); setCopied(false); }}
              className="w-full mt-2 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
            >
              Generate new link
            </button>
          )}
        </div>

        {/* How it works */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">How it works</p>
          <div className="space-y-2">
            {[
              { icon: 'fa-copy', text: 'Copy and send the link to your teammate' },
              { icon: 'fa-user-plus', text: 'They sign up or sign in at ganttbyjoe.netlify.app' },
              { icon: 'fa-check-circle', text: 'They click the link — project is added to their workspace' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-slate-500">
                <div className="w-6 h-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className={`fa-solid ${step.icon} text-[10px]`}></i>
                </div>
                {step.text}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShareModal;
