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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Share Project</h2>
            <p className="text-sm text-gray-500 mt-1">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        {/* Share Form */}
        {isOwner && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={loading}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleShare}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Invite'}
              </button>
            </div>

            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="mt-2 text-sm text-green-600">
                <i className="fa-solid fa-check mr-1"></i>
                {success}
              </p>
            )}

            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <i className="fa-solid fa-info-circle mr-1"></i>
                <strong>Editor:</strong> Can view and edit tasks
                <br />
                <strong>Viewer:</strong> Can only view (read-only)
              </p>
            </div>
          </div>
        )}

        {/* Members List */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Who has access ({members.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((member) => (
              <div
                key={member.email}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {member.displayName?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.displayName || member.email}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    member.role === 'owner'
                      ? 'bg-purple-100 text-purple-700'
                      : member.role === 'editor'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {member.role}
                  </span>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemove(member.email)}
                      className="text-red-500 hover:text-red-700 text-xs"
                      title="Remove"
                    >
                      <i className="fa-solid fa-times"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
