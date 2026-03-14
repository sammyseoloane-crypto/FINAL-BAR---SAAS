import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function GuestListsPage() {
  const { userProfile } = useAuth();
  const [guestLists, setGuestLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(false);

  useEffect(() => {
    fetchGuestLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchGuestLists = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('guest_lists')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Fetch promoter details separately if needed
      const listsWithPromoters = await Promise.all(
        (data || []).map(async (list) => {
          if (list.promoter_id) {
            const { data: promoter } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', list.promoter_id)
              .single();

            return { ...list, promoter };
          }
          return list;
        }),
      );

      setGuestLists(listsWithPromoters);
    } catch (error) {
      console.error('Error fetching guest lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuests = async (listId) => {
    setLoadingGuests(true);
    try {
      const { data, error } = await supabase
        .from('guest_list_entries')
        .select('*')
        .eq('guest_list_id', listId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setGuests(data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    } finally {
      setLoadingGuests(false);
    }
  };

  const approveGuest = async (guestId) => {
    try {
      const { error } = await supabase
        .from('guest_list_entries')
        .update({ status: 'approved' })
        .eq('id', guestId);

      if (error) {
        throw error;
      }
      fetchGuests(selectedList.id);
      alert('Guest approved');
    } catch (error) {
      console.error('Error approving guest:', error);
      alert('Failed to approve guest');
    }
  };

  const checkInGuest = async (guestId) => {
    try {
      const { error } = await supabase
        .from('guest_list_entries')
        .update({
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          checked_in_by: userProfile.id,
        })
        .eq('id', guestId);

      if (error) {
        throw error;
      }

      // Refetch both guests and lists (trigger auto-updates checked_in_count)
      fetchGuests(selectedList.id);
      fetchGuestLists();
      alert('Guest checked in');
    } catch (error) {
      console.error('Error checking in guest:', error);
      alert('Failed to check in guest');
    }
  };

  const viewListDetails = (list) => {
    setSelectedList(list);
    fetchGuests(list.id);
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📋 Guest Lists</h1>
          <p>View and manage event guest lists</p>
          {selectedList && (
            <button
              onClick={() => setSelectedList(null)}
              className="btn-secondary"
              style={{ marginTop: '10px' }}
            >
              ← Back to Lists
            </button>
          )}
        </div>

        {selectedList ? (
          // Guest details view
          <div>
            <div className="info-box" style={{ marginBottom: '20px' }}>
              <h3>{selectedList.list_name || 'Guest List'}</h3>
              <p><strong>Event Date:</strong> {selectedList.event_date ? new Date(selectedList.event_date).toLocaleDateString() : 'N/A'}</p>
              <p><strong>Promoter:</strong> {selectedList.promoter?.full_name || selectedList.promoter?.email || 'N/A'}</p>
              <p><strong>Total Guests:</strong> {selectedList.current_guest_count || 0} | <strong>Checked In:</strong> {selectedList.checked_in_count || 0}</p>
            </div>

            {loadingGuests ? (
              <div className="loading">Loading guests...</div>
            ) : guests.length === 0 ? (
              <div className="info-box">No guests in this list.</div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email/Phone</th>
                      <th>Plus Ones</th>
                      <th>Status</th>
                      <th>Checked In</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((guest) => (
                      <tr key={guest.id}>
                        <td>{guest.guest_name || 'N/A'}</td>
                        <td>{guest.guest_email || guest.guest_phone || 'N/A'}</td>
                        <td>{guest.plus_ones || 0}</td>
                        <td>
                          <span className={`status-badge status-${guest.status || 'pending'}`}>
                            {guest.status || 'pending'}
                          </span>
                        </td>
                        <td>
                          {guest.checked_in ? (
                            <span className="status-badge status-success">✓ Checked In</span>
                          ) : (
                            <span className="status-badge status-pending">Not Checked In</span>
                          )}
                        </td>
                        <td>
                          {guest.status === 'pending' && (
                            <button
                              onClick={() => approveGuest(guest.id)}
                              className="btn-success"
                              style={{ marginRight: '5px' }}
                            >
                              Approve
                            </button>
                          )}
                          {guest.status === 'approved' && !guest.checked_in && (
                            <button
                              onClick={() => checkInGuest(guest.id)}
                              className="btn-primary"
                            >
                              Check In
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          // Guest lists overview
          <>
            {loading ? (
              <div className="loading">Loading guest lists...</div>
            ) : guestLists.length === 0 ? (
              <div className="info-box">
                <p>No guest lists found.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>List Name</th>
                      <th>Event Date</th>
                      <th>Promoter</th>
                      <th>Total Guests</th>
                      <th>Checked In</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestLists.map((list) => (
                      <tr key={list.id}>
                        <td>{list.list_name || 'N/A'}</td>
                        <td>{list.event_date ? new Date(list.event_date).toLocaleDateString() : 'N/A'}</td>
                        <td>{list.promoter?.full_name || list.promoter?.email || 'N/A'}</td>
                        <td>{list.current_guest_count || 0}</td>
                        <td>{list.checked_in_count || 0}</td>
                        <td>
                          <span className={`status-badge status-${list.status || 'active'}`}>
                            {list.status || 'active'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => viewListDetails(list)}
                            className="btn-primary"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="info-box" style={{ marginTop: '20px' }}>
          <strong>ℹ️ Guest List Management:</strong>
          <ul>
            <li>✅ View all guest lists for events</li>
            <li>✅ Approve pending guests</li>
            <li>✅ Check in guests at the door</li>
            <li>✅ Track attendance and plus-ones</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
