import { createContext, useContext, useState } from 'react';
import PropTypes from 'prop-types';

const NotificationContext = createContext({});

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();

    const notification = {
      id,
      message,
      type, // 'success', 'error', 'warning', 'info'
      duration,
    };

    setNotifications((prev) => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Convenience methods
  const success = (message, duration) => showNotification(message, 'success', duration);
  const error = (message, duration) => showNotification(message, 'error', duration);
  const warning = (message, duration) => showNotification(message, 'warning', duration);
  const info = (message, duration) => showNotification(message, 'info', duration);

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        removeNotification,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

function NotificationContainer({ notifications, onRemove }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
      }}
    >
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onRemove={onRemove} />
      ))}
    </div>
  );
}

NotificationContainer.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
    })).isRequired,
  onRemove: PropTypes.func.isRequired,
};

function NotificationItem({ notification, onRemove }) {
  const { id, message, type } = notification;

  const colors = {
    success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724', icon: '✓' },
    error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24', icon: '✗' },
    warning: { bg: '#fff3cd', border: '#ffeeba', text: '#856404', icon: '⚠' },
    info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460', icon: 'ℹ' },
  };

  const style = colors[type] || colors.info;

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        color: style.text,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        animation: 'slideInRight 0.3s ease-out',
        minWidth: '300px',
        maxWidth: '400px',
      }}
    >
      <span
        style={{
          fontSize: '20px',
          fontWeight: 'bold',
          minWidth: '24px',
          textAlign: 'center',
        }}
      >
        {style.icon}
      </span>
      <span style={{ flex: 1, fontSize: '14px' }}>{message}</span>
      <button
        onClick={() => onRemove(id)}
        style={{
          background: 'none',
          border: 'none',
          color: style.text,
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.target.style.opacity = 1)}
        onMouseLeave={(e) => (e.target.style.opacity = 0.7)}
        aria-label="Close notification"
      >
        ×
      </button>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    message: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['success', '	error', 'warning', 'info']).isRequired,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
};
