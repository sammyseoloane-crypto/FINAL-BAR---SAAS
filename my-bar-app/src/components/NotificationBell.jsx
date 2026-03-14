import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import './NotificationBell.css';

export default function NotificationBell() {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile?.id) {
      loadNotifications();
      const cleanup = subscribeToNotifications();
      return cleanup;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  async function loadNotifications() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setNotifications(data || []);
      updateUnreadCount(data || []);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  function subscribeToNotifications() {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications((prev) => [payload.new, ...prev]);
            updateUnreadCount([payload.new, ...notifications]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications((prev) => {
              const updated = prev.map((n) => (n.id === payload.new.id ? payload.new : n));
              updateUnreadCount(updated);
              return updated;
            });
          }
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  function updateUnreadCount(notifs) {
    const count = notifs.filter((n) => !n.read).length;
    setUnreadCount(count);
  }

  async function markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
        updateUnreadCount(updated);
        return updated;
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userProfile.id)
        .eq('read', false);

      if (error) {
        throw error;
      }

      await loadNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }

  function getNotificationIcon(type) {
    const icons = {
      payment_confirmed: '💳',
      event_reminder: '📅',
      low_inventory: '📦',
      staff_invited: '👥',
      task_assigned: '📝',
      qr_scanned: '🎫',
    };
    return icons[type] || '🔔';
  }

  function getTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);

    if (seconds < 60) {
      return 'just now';
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    }
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}h ago`;
    }
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return (
    <div className="notification-bell-container">
      <button
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <div className="spinner-small"></div>
                <p>Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    if (notification.action_url) {
                      window.location.href = notification.action_url;
                    }
                  }}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {getTimeAgo(notification.created_at)}
                    </span>
                  </div>
                  {!notification.read && <div className="unread-indicator"></div>}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <a href="/notifications">View all notifications</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
