import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import {
  canAddGuests,
  canEditGuest,
  canRemoveGuests,
  canVerifyGuests,
  getPermissionSummary,
} from '../../utils/guestListPermissions';
import '../Dashboard.css';

export default function GuestListsPage() {
  const { userProfile } = useAuth();
  const [guestLists, setGuestLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [guestForm, setGuestForm] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    plus_ones: 0,
  });

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

  const addGuest = async (e) => {
    e.preventDefault();

    if (!canAddGuests(userProfile.role)) {
      alert('You do not have permission to add guests');
      return;
    }

    try {
      const { error } = await supabase
        .from('guest_list_entries')
        .insert({
          guest_list_id: selectedList.id,
          guest_name: guestForm.guest_name,
          guest_email: guestForm.guest_email || null,
          guest_phone: guestForm.guest_phone || null,
          plus_ones: parseInt(guestForm.plus_ones) || 0,
          status: 'approved', // Managers/owners can approve immediately
          added_by: userProfile.id,
          tenant_id: userProfile.tenant_id,
        });

      if (error) {
        throw error;
      }

      alert('Guest added successfully');
      setShowAddForm(false);
      setGuestForm({ guest_name: '', guest_email: '', guest_phone: '', plus_ones: 0 });
      fetchGuests(selectedList.id);
      fetchGuestLists(); // Refresh counts
    } catch (error) {
      console.error('Error adding guest:', error);
      alert(`Failed to add guest: ${error.message}`);
    }
  };

  const updateGuest = async (e) => {
    e.preventDefault();

    if (!editingGuest) {
      return;
    }

    // Check if user can edit this specific guest
    if (!canEditGuest(userProfile.role, userProfile.id, editingGuest.added_by)) {
      alert('You can only edit guests you added');
      return;
    }

    try {
      const { error } = await supabase
        .from('guest_list_entries')
        .update({
          guest_name: guestForm.guest_name,
          guest_email: guestForm.guest_email || null,
          guest_phone: guestForm.guest_phone || null,
          plus_ones: parseInt(guestForm.plus_ones) || 0,
        })
        .eq('id', editingGuest.id);

      if (error) {
        throw error;
      }

      alert('Guest updated successfully');
      setEditingGuest(null);
      setGuestForm({ guest_name: '', guest_email: '', guest_phone: '', plus_ones: 0 });
      fetchGuests(selectedList.id);
    } catch (error) {
      console.error('Error updating guest:', error);
      alert(`Failed to update guest: ${error.message}`);
    }
  };

  const removeGuest = async (guestId) => {
    if (!canRemoveGuests(userProfile.role)) {
      alert('You do not have permission to remove guests');
      return;
    }

    if (!confirm('Are you sure you want to remove this guest?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('guest_list_entries')
        .delete()
        .eq('id', guestId);

      if (error) {
        throw error;
      }

      alert('Guest removed successfully');
      fetchGuests(selectedList.id);
      fetchGuestLists(); // Refresh counts
    } catch (error) {
      console.error('Error removing guest:', error);
      alert(`Failed to remove guest: ${error.message}`);
    }
  };

  const startEditGuest = (guest) => {
    // Check permission before allowing edit
    if (!canEditGuest(userProfile.role, userProfile.id, guest.added_by)) {
      alert('You can only edit guests you added');
      return;
    }

    setEditingGuest(guest);
    setGuestForm({
      guest_name: guest.guest_name || '',
      guest_email: guest.guest_email || '',
      guest_phone: guest.guest_phone || '',
      plus_ones: guest.plus_ones || 0,
    });
    setShowAddForm(false); // Close add form if open
  };

  const cancelEdit = () => {
    setEditingGuest(null);
    setGuestForm({ guest_name: '', guest_email: '', guest_phone: '', plus_ones: 0 });
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

            {/* Add Guest Button */}
            {canAddGuests(userProfile.role) && !editingGuest && (
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setEditingGuest(null);
                }}
                className="btn-success"
                style={{ marginBottom: '15px' }}
              >
                {showAddForm ? 'Cancel' : '+ Add Guest'}
              </button>
            )}

            {/* Add Guest Form */}
            {showAddForm && !editingGuest && (
              <div className="form-container" style={{ marginBottom: '20px' }}>
                <h3>Add New Guest</h3>
                <form onSubmit={addGuest}>
                  <div className="form-group">
                    <label>Guest Name *</label>
                    <input
                      type="text"
                      value={guestForm.guest_name}
                      onChange={(e) => setGuestForm({ ...guestForm, guest_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={guestForm.guest_email}
                      onChange={(e) => setGuestForm({ ...guestForm, guest_email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={guestForm.guest_phone}
                      onChange={(e) => setGuestForm({ ...guestForm, guest_phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Plus Ones</label>
                    <input
                      type="number"
                      min="0"
                      value={guestForm.plus_ones}
                      onChange={(e) => setGuestForm({ ...guestForm, plus_ones: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn-success">Add Guest</button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="btn-secondary"
                    style={{ marginLeft: '10px' }}
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Edit Guest Form */}
            {editingGuest && (
              <div className="form-container" style={{ marginBottom: '20px', backgroundColor: '#fff3cd' }}>
                <h3>✏️ Edit Guest</h3>
                <form onSubmit={updateGuest}>
                  <div className="form-group">
                    <label>Guest Name *</label>
                    <input
                      type="text"
                      value={guestForm.guest_name}
                      onChange={(e) => setGuestForm({ ...guestForm, guest_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={guestForm.guest_email}
                      onChange={(e) => setGuestForm({ ...guestForm, guest_email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={guestForm.guest_phone}
                      onChange={(e) => setGuestForm({ ...guestForm, guest_phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Plus Ones</label>
                    <input
                      type="number"
                      min="0"
                      value={guestForm.plus_ones}
                      onChange={(e) => setGuestForm({ ...guestForm, plus_ones: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn-success">Save Changes</button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="btn-secondary"
                    style={{ marginLeft: '10px' }}
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

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
                          {/* Edit Button - Only if user can edit this specific guest */}
                          {canEditGuest(userProfile.role, userProfile.id, guest.added_by) && (
                            <button
                              onClick={() => startEditGuest(guest)}
                              className="btn-secondary"
                              style={{ marginRight: '5px' }}
                            >
                              ✏️ Edit
                            </button>
                          )}

                          {/* Approve Button */}
                          {guest.status === 'pending' && (
                            <button
                              onClick={() => approveGuest(guest.id)}
                              className="btn-success"
                              style={{ marginRight: '5px' }}
                            >
                              Approve
                            </button>
                          )}

                          {/* Check In Button - Only if user can verify guests */}
                          {canVerifyGuests(userProfile.role) && guest.status === 'approved' && !guest.checked_in && (
                            <button
                              onClick={() => checkInGuest(guest.id)}
                              className="btn-primary"
                              style={{ marginRight: '5px' }}
                            >
                              Check In
                            </button>
                          )}

                          {/* Remove Button - Only if user can remove guests */}
                          {canRemoveGuests(userProfile.role) && (
                            <button
                              onClick={() => removeGuest(guest.id)}
                              className="btn-danger"
                            >
                              Remove
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
          <strong>ℹ️ Your Permissions ({userProfile.role}):</strong>
          <ul>
            {getPermissionSummary(userProfile.role).map((permission, index) => (
              <li key={index}>✅ {permission}</li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
