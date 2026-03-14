import { useEffect } from 'react';
import './Toast.css';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
