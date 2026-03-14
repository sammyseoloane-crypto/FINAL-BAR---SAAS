/**
 * Offline Queue Manager
 * Handles offline order synchronization and queue management
 */

import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './OfflineQueue.css';

function OfflineQueue() {
  const [queueItems, setQueueItems] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load queue from localStorage
    loadQueueFromStorage();

    // Auto-sync every 30 seconds if online
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        syncQueue();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQueueFromStorage = () => {
    const stored = localStorage.getItem('offline_queue');
    if (stored) {
      setQueueItems(JSON.parse(stored));
    }
  };

  const saveQueueToStorage = (items) => {
    localStorage.setItem('offline_queue', JSON.stringify(items));
  };

  const syncQueue = async () => {
    if (queueItems.length === 0 || syncStatus === 'syncing') {
      return;
    }

    setSyncStatus('syncing');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSyncStatus('error');
        return;
      }

      // Get tenant_id from user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setSyncStatus('error');
        return;
      }

      const successfulSyncs = [];
      const failedSyncs = [];

      // Process queue items sequentially to ensure order
      /* eslint-disable no-await-in-loop */
      for (const item of queueItems) {
        if (item.status === 'completed') {
          continue;
        }

        try {
          // Insert into offline_queue table
          const { data, error } = await supabase
            .from('offline_queue')
            .insert({
              tenant_id: profile.tenant_id,
              user_id: user.id,
              device_id: item.device_id,
              action_type: item.action_type,
              payload: item.payload,
              status: 'pending',
              retry_count: item.retry_count,
            })
            .select()
            .single();

          if (error) {
            throw error;
          }

          // Process the action
          await processQueueItem(data);

          successfulSyncs.push(item.id);
        } catch (error) {
          console.error('Sync error:', error);
          failedSyncs.push(item.id);

          // Increment retry count
          const updatedQueue = queueItems.map((q) =>
            q.id === item.id ? { ...q, retry_count: q.retry_count + 1 } : q,
          );
          setQueueItems(updatedQueue);
          saveQueueToStorage(updatedQueue);
        }
      }
      /* eslint-enable no-await-in-loop */

      // Remove successful syncs from local queue
      const remainingQueue = queueItems.filter((item) => !successfulSyncs.includes(item.id));
      setQueueItems(remainingQueue);
      saveQueueToStorage(remainingQueue);

      setSyncStatus(failedSyncs.length === 0 ? 'success' : 'error');
    } catch (error) {
      console.error('Queue sync error:', error);
      setSyncStatus('error');
    }
  };

  const processQueueItem = async (queueItem) => {
    const { action_type, payload } = queueItem;

    switch (action_type) {
      case 'create_transaction':
        await supabase.from('transactions').insert(payload);
        break;
      case 'update_transaction':
        await supabase.from('transactions').update(payload.data).eq('id', payload.id);
        break;
      case 'create_order':
        await supabase.from('orders').insert(payload);
        break;
      case 'scan_qr_code':
        await supabase.from('qr_code_scans').insert(payload);
        break;
      default:
        console.warn('Unknown action type:', action_type);
    }

    // Mark as completed
    await supabase
      .from('offline_queue')
      .update({ status: 'completed', synced_at: new Date().toISOString() })
      .eq('id', queueItem.id);
  };

  const retryFailed = async () => {
    const failedItems = queueItems.filter((item) => item.retry_count > 0);
    for (const item of failedItems) {
      const updatedQueue = queueItems.map((q) =>
        q.id === item.id ? { ...q, retry_count: 0, status: 'pending' } : q,
      );
      setQueueItems(updatedQueue);
      saveQueueToStorage(updatedQueue);
    }
    await syncQueue();
  };

  const clearCompleted = () => {
    const pendingQueue = queueItems.filter((item) => item.status !== 'completed');
    setQueueItems(pendingQueue);
    saveQueueToStorage(pendingQueue);
  };

  return (
    <div className="offline-queue">
      <div className="offline-queue-header">
        <h2>Offline Queue</h2>
        <div className="connection-status">
          <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}></span>
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="sync-status">
        {syncStatus === 'syncing' && (
          <div className="status-message syncing">
            <span className="spinner"></span>
            Syncing queue...
          </div>
        )}
        {syncStatus === 'success' && (
          <div className="status-message success">✓ Queue synced successfully</div>
        )}
        {syncStatus === 'error' && (
          <div className="status-message error">✗ Sync failed. Will retry automatically.</div>
        )}
      </div>

      <div className="queue-stats">
        <div className="stat">
          <span className="stat-label">Pending Items</span>
          <span className="stat-value">
            {queueItems.filter((i) => i.status === 'pending').length}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Failed Items</span>
          <span className="stat-value">{queueItems.filter((i) => i.retry_count > 0).length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total in Queue</span>
          <span className="stat-value">{queueItems.length}</span>
        </div>
      </div>

      <div className="queue-actions">
        <button onClick={syncQueue} disabled={!isOnline || queueItems.length === 0}>
          Sync Now
        </button>
        <button
          onClick={retryFailed}
          disabled={queueItems.filter((i) => i.retry_count > 0).length === 0}
        >
          Retry Failed
        </button>
        <button onClick={clearCompleted}>Clear Completed</button>
      </div>

      <div className="queue-list">
        {queueItems.length === 0 ? (
          <div className="empty-state">
            <p>Queue is empty</p>
            <small>Actions performed offline will appear here</small>
          </div>
        ) : (
          queueItems.map((item) => (
            <div key={item.id} className={`queue-item ${item.status}`}>
              <div className="item-icon">
                {item.retry_count > 0 ? '⚠️' : item.status === 'completed' ? '✓' : '⏳'}
              </div>
              <div className="item-details">
                <div className="item-action">{item.action_type.replace(/_/g, ' ')}</div>
                <div className="item-time">{new Date(item.created_at).toLocaleString()}</div>
                {item.retry_count > 0 && (
                  <div className="item-retries">Retries: {item.retry_count}</div>
                )}
              </div>
              <div className="item-status">{item.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default OfflineQueue;

// Export the hook for use in other components
export const useOfflineQueue = () => {
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    let storedDeviceId = localStorage.getItem('device_id');
    if (!storedDeviceId) {
      storedDeviceId = crypto.randomUUID();
      localStorage.setItem('device_id', storedDeviceId);
    }
    setDeviceId(storedDeviceId);
  }, []);

  const addToQueue = (actionType, payload) => {
    const queueItem = {
      id: crypto.randomUUID(),
      device_id: deviceId,
      action_type: actionType,
      payload: payload,
      status: 'pending',
      created_at: new Date().toISOString(),
      retry_count: 0,
    };

    const stored = localStorage.getItem('offline_queue');
    const queue = stored ? JSON.parse(stored) : [];
    queue.push(queueItem);
    localStorage.setItem('offline_queue', JSON.stringify(queue));

    // Dispatch custom event for OfflineQueue component to detect
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));

    return queueItem.id;
  };

  return { addToQueue, deviceId };
};
