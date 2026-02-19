import React, { useState } from 'react';
import { shareProject, removeMember } from '../services/firebaseService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  members: Array<{ email: string; role: string; displayName: string }>;
  isOwner: boolean;
}

const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName,
  members,
  isOwner 
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  if (!isOpen) return null;

  // Generate shareable link
  const shareableLink = `${window.location.origin}?project=${projectId}`;

  const handleShare = async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await shareProject(projectId, email.trim().toLowerCase(), role);
      
      setSuccess(`Invited ${email} as ${role}`);
      setEmail('');
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to share project');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberEmail: string) => {
    if (!confirm(`Remove ${memberEmail} from this project?`)) return;

    try {
      await removeMember(projectId, memberEmail);
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const copyLinkToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy link');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Share "{projectName}"</h2>
            <p className="text-sm text-gray-500 mt-1">Invite people to collaborate</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        {/* Shareable Link Section */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <i className="fa-solid fa-link"></i>
                Get shareable link
              </h3>
              <p className="text-xs text-blue-700 mt-1">
                Anyone with this link can view this project
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={shareableLink}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={copyLinkToClipboard}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
            >
              {linkCopied ? (
                <>
                  <i className="fa-solid fa-check"></i>
                  Copied!
                </>
              ) : (
                <>
                  <i className="fa-solid fa-copy"></i>
                  Copy link
                </>
              )}
            </button>
          </div>

          <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
            <i className="fa-solid fa-info-circle mr-1"></i>
            <strong>Note:</strong> People with the link will need to sign in to access the project
          </div>
        </div>

        {/* Email Invite Section */}
        {isOwner && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i className="fa-solid fa-envelope"></i>
              Invite by email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                placeholder="colleague@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={loading}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                disabled={loading}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button
                onClick={handleShare}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <>
                    <i className="fa-solid fa-user-plus"></i>
                    Invite
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
                <i className="fa-solid fa-exclamation-circle"></i>
                {error}
              </div>
            )}
            {success && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 flex items-center gap-2">
                <i className="fa-solid fa-check-circle"></i>
                {success}
              </div>
            )}

            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-700 space-y-1">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-pencil text-blue-600 mt-0.5"></i>
                  <div>
                    <strong>Can edit:</strong> Add, modify, and delete tasks
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-eye text-gray-600 mt-0.5"></i>
                  <div>
                    <strong>Can view:</strong> Read-only access to view tasks
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Members List */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <i className="fa-solid fa-users"></i>
            People with access ({members.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((member) => (
              <div
                key={member.email}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white text-sm font-bold">
                      {member.displayName?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.displayName || member.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    member.role === 'owner'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : member.role === 'editor'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {member.role === 'owner' ? (
                      <>
                        <i className="fa-solid fa-crown mr-1"></i>
                        Owner
                      </>
                    ) : member.role === 'editor' ? (
                      <>
                        <i className="fa-solid fa-pencil mr-1"></i>
                        Can edit
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-eye mr-1"></i>
                        Can view
                      </>
                    )}
                  </span>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemove(member.email)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                      title="Remove access"
                    >
                      <i className="fa-solid fa-user-minus"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
