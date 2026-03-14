/**
 * Offline Utilities
 * Helper functions for offline queue management and sync
 */

import { supabase } from '../supabaseClient';

const QUEUE_KEY = 'offline_queue';
const DEVICE_ID_KEY = 'device_id';

/**
 * Generate unique device ID
 */
export const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
};

/**
 * Get offline queue from localStorage
 */
export const getOfflineQueue = () => {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error reading offline queue:', error);
    return [];
  }
};

/**
 * Save offline queue to localStorage
 */
export const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (error) {
    console.error('Error saving offline queue:', error);
    return false;
  }
};

/**
 * Add item to offline queue
 */
export const addToOfflineQueue = (action, data) => {
  try {
    const queue = getOfflineQueue();
    const queueItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: action,
      data: data,
      timestamp: new Date().toISOString(),
      device_id: getDeviceId(),
      retries: 0,
      status: 'pending',
    };

    queue.push(queueItem);
    saveOfflineQueue(queue);

    return queueItem;
  } catch (error) {
    console.error('Error adding to offline queue:', error);
    return null;
  }
};

/**
 * Remove item from offline queue
 */
export const removeFromOfflineQueue = (itemId) => {
  try {
    const queue = getOfflineQueue();
    const filteredQueue = queue.filter((item) => item.id !== itemId);
    saveOfflineQueue(filteredQueue);
    return true;
  } catch (error) {
    console.error('Error removing from offline queue:', error);
    return false;
  }
};

/**
 * Update queue item status
 */
export const updateQueueItemStatus = (itemId, status, error = null) => {
  try {
    const queue = getOfflineQueue();
    const item = queue.find((i) => i.id === itemId);

    if (item) {
      item.status = status;
      item.last_attempt = new Date().toISOString();

      if (error) {
        item.error = error;
      }

      if (status === 'syncing') {
        item.retries += 1;
      }

      saveOfflineQueue(queue);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error updating queue item:', error);
    return false;
  }
};

/**
 * Sync offline queue with server
 */
export const syncOfflineQueue = async () => {
  if (!navigator.onLine) {
    // eslint-disable-next-line no-console
    console.log('Cannot sync: offline');
    return { success: false, error: 'offline' };
  }

  const queue = getOfflineQueue();
  const results = {
    total: queue.length,
    synced: 0,
    failed: 0,
    errors: [],
  };

  // Process queue items sequentially to maintain order
  /* eslint-disable no-await-in-loop */
  for (const item of queue) {
    if (item.status === 'synced') {
      continue;
    }

    updateQueueItemStatus(item.id, 'syncing');

    try {
      let syncResult;

      switch (item.action) {
        case 'create_transaction':
          syncResult = await syncTransaction(item.data);
          break;

        case 'update_transaction':
          syncResult = await syncTransactionUpdate(item.data);
          break;

        case 'create_order':
          syncResult = await syncOrder(item.data);
          break;

        case 'scan_qr_code':
          syncResult = await syncQRScan(item.data);
          break;

        default:
          throw new Error(`Unknown action: ${item.action}`);
      }

      if (syncResult.success) {
        // Save to offline_queue table for audit
        await supabase.from('offline_queue').insert([
          {
            device_id: item.device_id,
            action: item.action,
            payload: item.data,
            status: 'synced',
            synced_at: new Date().toISOString(),
          },
        ]);

        updateQueueItemStatus(item.id, 'synced');
        removeFromOfflineQueue(item.id);
        results.synced += 1;
      } else {
        throw new Error(syncResult.error || 'Sync failed');
      }
    } catch (error) {
      console.error(`Error syncing item ${item.id}:`, error);

      if (item.retries >= 3) {
        updateQueueItemStatus(item.id, 'failed', error.message);
      } else {
        updateQueueItemStatus(item.id, 'pending', error.message);
      }

      results.failed += 1;
      results.errors.push({
        itemId: item.id,
        action: item.action,
        error: error.message,
      });
    }
  }
  /* eslint-enable no-await-in-loop */

  return results;
};

/**
 * Sync transaction to server
 */
const syncTransaction = async (data) => {
  try {
    const { data: result, error } = await supabase
      .from('transactions')
      .insert([data])
      .select()
      .single();

    if (error) {
      throw error;
    }
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sync transaction update to server
 */
const syncTransactionUpdate = async (data) => {
  try {
    const { id, ...updates } = data;

    const { data: result, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sync order to server
 */
const syncOrder = async (data) => {
  try {
    const { data: result, error } = await supabase.from('orders').insert([data]).select().single();

    if (error) {
      throw error;
    }
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sync QR code scan to server
 */
const syncQRScan = async (data) => {
  try {
    const { data: result, error } = await supabase
      .from('qr_scans')
      .insert([data])
      .select()
      .single();

    if (error) {
      throw error;
    }
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Check online status
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Get queue statistics
 */
export const getQueueStats = () => {
  const queue = getOfflineQueue();

  return {
    total: queue.length,
    pending: queue.filter((i) => i.status === 'pending').length,
    failed: queue.filter((i) => i.status === 'failed').length,
    synced: queue.filter((i) => i.status === 'synced').length,
  };
};

/**
 * Clear synced items from queue
 */
export const clearSyncedItems = () => {
  try {
    const queue = getOfflineQueue();
    const pendingQueue = queue.filter((item) => item.status !== 'synced');
    saveOfflineQueue(pendingQueue);
    return true;
  } catch (error) {
    console.error('Error clearing synced items:', error);
    return false;
  }
};

/**
 * Clear entire queue (caution!)
 */
export const clearOfflineQueue = () => {
  try {
    localStorage.removeItem(QUEUE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing offline queue:', error);
    return false;
  }
};
