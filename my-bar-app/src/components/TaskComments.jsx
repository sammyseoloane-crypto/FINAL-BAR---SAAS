import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import '../pages/owner/Pages.css';

/**
 * TaskComments Component
 * Allows users to add and view comments on tasks
 */
export default function TaskComments({ taskId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(
          `
          id,
          comment,
          created_at,
          updated_at,
          users:user_id (
            email,
            role
          )
        `,
        )
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('task_comments').insert([
        {
          task_id: taskId,
          user_id: user.id,
          comment: newComment.trim(),
        },
      ]);

      if (error) {
        throw error;
      }

      setNewComment('');
      fetchComments();
    } catch (error) {
      alert(`Error adding comment: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('Delete this comment?')) {
      return;
    }

    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', commentId);

      if (error) {
        throw error;
      }
      fetchComments();
    } catch (error) {
      alert(`Error deleting comment: ${error.message}`);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    if (days < 7) {
      return `${days}d ago`;
    }
    return date.toLocaleDateString();
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
      case 'admin':
        return '#d4af37';
      case 'staff':
        return '#48bb78';
      case 'customer':
        return '#ffc107';
      default:
        return '#666';
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading comments...</div>;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h4 style={{ marginBottom: '15px', color: '#333' }}>💬 Comments ({comments.length})</h4>

      {/* Comments List */}
      <div style={{ marginBottom: '20px', maxHeight: '400px', overflowY: 'auto' }}>
        {comments.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '30px',
              color: '#666',
              background: '#f7fafc',
              borderRadius: '8px',
            }}
          >
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  background: '#f7fafc',
                  padding: '15px',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${getRoleBadgeColor(comment.users?.role)}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <strong style={{ color: '#333' }}>
                      {comment.users?.email || 'Unknown User'}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.75em',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: getRoleBadgeColor(comment.users?.role),
                        color: 'white',
                        textTransform: 'capitalize',
                      }}
                    >
                      {comment.users?.role || 'user'}
                    </span>
                    <span style={{ fontSize: '0.85em', color: '#666' }}>
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  {comment.user_id === user.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#dc3545',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '0.85em',
                      }}
                      title="Delete comment"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <div
                  style={{
                    color: '#333',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {comment.comment}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e0e0e0',
              resize: 'vertical',
              minHeight: '60px',
              fontFamily: 'inherit',
            }}
            disabled={submitting}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !newComment.trim()}
            style={{
              alignSelf: 'flex-end',
              minWidth: '100px',
            }}
          >
            {submitting ? 'Posting...' : '💬 Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
