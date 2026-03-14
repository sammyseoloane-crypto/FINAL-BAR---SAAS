import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function CustomerGuestListPage() {
  const { userProfile } = useAuth();
  const [guestLists, setGuestLists] = useState([]);
  const [myEntries, setMyEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('available'); // 'available' or 'my-lists'

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchGuestLists();
      fetchMyEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchGuestLists = async () => {
    try {
      const { data, error } = await supabase
        .from('guest_lists')
        .select(`
          *,
          events!event_id (
            name,
            date
          )
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .eq('status', 'active')
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

  const fetchMyEntries = async () => {
    if (!userProfile?.email) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('guest_list_entries')
        .select(`
          *,
          guest_lists!guest_list_id (
            list_name,
            events!event_id (
              name,
              date
            )
          )
        `)
        .eq('guest_email', userProfile.email)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setMyEntries(data || []);
    } catch (error) {
      console.error('Error fetching my entries:', error);
    }
  };

  const joinGuestList = async (guestListId) => {
    if (!userProfile?.email || !userProfile?.full_name) {
      alert('Please complete your profile before joining a guest list.');
      return;
    }

    try {
      // Check if already on the list
      const { data: existing } = await supabase
        .from('guest_list_entries')
        .select('id')
        .eq('guest_list_id', guestListId)
        .eq('guest_email', userProfile.email)
        .single();

      if (existing) {
        alert("You're already on this guest list!");
        return;
      }

      // Add to guest list
      const { error } = await supabase
        .from('guest_list_entries')
        .insert({
          guest_list_id: guestListId,
          guest_name: userProfile.full_name,
          guest_email: userProfile.email,
          guest_phone: userProfile.phone || '',
          status: 'pending',
        });

      if (error) {
        throw error;
      }

      alert('Successfully joined the guest list! Wait for approval.');
      fetchMyEntries();
    } catch (error) {
      console.error('Error joining guest list:', error);
      alert('Failed to join guest list. Please try again.');
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📋 Guest Lists</h1>
          <p>Join event guest lists</p>
          <div style={{ marginTop: '10px' }}>
            <button
              className={view === 'available' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setView('available')}
              style={{ marginRight: '10px' }}
            >
              Available Lists
            </button>
            <button
              className={view === 'my-lists' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setView('my-lists')}
            >
              My Guest Lists
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading guest lists...</div>
        ) : view === 'available' ? (
          <div>
            {guestLists.length === 0 ? (
              <div className="info-box">
                <p>No active guest lists available at the moment.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>List Name</th>
                      <th>Event</th>
                      <th>Event Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestLists.map((list) => (
                      <tr key={list.id}>
                        <td><strong>{list.list_name}</strong></td>
                        <td>{list.events?.name || 'N/A'}</td>
                        <td>
                          {list.events?.date
                            ? new Date(list.events.date).toLocaleDateString()
                            : 'TBD'}
                        </td>
                        <td>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => joinGuestList(list.id)}
                          >
                            ✅ Join List
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            {myEntries.length === 0 ? (
              <div className="info-box">
                <p>You have not joined any guest lists yet.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>List Name</th>
                      <th>Event</th>
                      <th>Event Date</th>
                      <th>Status</th>
                      <th>Checked In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td><strong>{entry.guest_lists?.list_name || 'N/A'}</strong></td>
                        <td>{entry.guest_lists?.events?.name || 'N/A'}</td>
                        <td>
                          {entry.guest_lists?.events?.date
                            ? new Date(entry.guest_lists.events.date).toLocaleDateString()
                            : 'TBD'}
                        </td>
                        <td>
                          <span className={`status-badge status-${entry.status}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td>
                          {entry.checked_in_at ? (
                            <span style={{ color: 'green' }}>✅ Checked In</span>
                          ) : (
                            <span style={{ color: '#666' }}>Not Yet</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
