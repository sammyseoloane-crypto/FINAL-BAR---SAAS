import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function PromoterGuestListsPage() {
  const { userProfile } = useAuth();
  const [guestLists, setGuestLists] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newList, setNewList] = useState({ event_id: '', list_name: '' });

  useEffect(() => {
    fetchGuestLists();
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchGuestLists = async () => {
    if (!userProfile?.id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('guest_lists')
        .select('*, events!event_id(name)')
        .eq('promoter_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setGuestLists(data || []);
    } catch (error) {
      console.error('Error fetching guest lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, date')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const createGuestList = async (e) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('guest_lists')
        .insert({
          event_id: newList.event_id,
          promoter_id: userProfile.id,
          tenant_id: userProfile.tenant_id,
          list_name: newList.list_name,
          status: 'active',
        });

      if (error) {
        throw error;
      }

      alert('Guest list created successfully');
      setShowCreateForm(false);
      setNewList({ event_id: '', list_name: '' });
      fetchGuestLists();
    } catch (error) {
      console.error('Error creating guest list:', error);
      alert('Failed to create guest list');
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📋 My Guest Lists</h1>
          <p>Create and manage your guest lists</p>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary"
            style={{ marginTop: '10px' }}
          >
            {showCreateForm ? 'Cancel' : '+ Create New List'}
          </button>
        </div>

        {showCreateForm && (
          <div className="form-container" style={{ marginBottom: '20px' }}>
            <form onSubmit={createGuestList}>
              <div className="form-group">
                <label>Event:</label>
                <select
                  value={newList.event_id}
                  onChange={(e) => setNewList({ ...newList, event_id: e.target.value })}
                  required
                >
                  <option value="">Select an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>List Name:</label>
                <input
                  type="text"
                  value={newList.list_name}
                  onChange={(e) => setNewList({ ...newList, list_name: e.target.value })}
                  placeholder="e.g., VIP Guests"
                  required
                />
              </div>
              <button type="submit" className="btn-success">
                Create List
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading guest lists...</div>
        ) : guestLists.length === 0 ? (
          <div className="info-box">
            <p>No guest lists yet. Create your first list to start inviting guests!</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>List Name</th>
                  <th>Event</th>
                  <th>Total Guests</th>
                  <th>Checked In</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {guestLists.map((list) => (
                  <tr key={list.id}>
                    <td>{list.list_name}</td>
                    <td>{list.events?.name || 'N/A'}</td>
                    <td>{list.total_guests || 0}</td>
                    <td>{list.checked_in_count || 0}</td>
                    <td>
                      <span className={`status-badge status-${list.status}`}>
                        {list.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
