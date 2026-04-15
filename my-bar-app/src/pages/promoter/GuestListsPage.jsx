import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import {
  canAddGuests,
  canEditGuest,
  canRemoveGuests,
  canVerifyGuests,
  canCreateLists,
  getPermissionSummary,
} from '../../utils/guestListPermissions';
import '../Dashboard.css';

export default function PromoterGuestListsPage() {
  const { userProfile } = useAuth();
  const [guestLists, setGuestLists] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newList, setNewList] = useState({ event_id: '', list_name: '' });
  const [selectedList, setSelectedList] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [showAddGuestForm, setShowAddGuestForm] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [guestForm, setGuestForm] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    plus_ones: 0,
  });
  const [editingListName, setEditingListName] = useState(false);
  const [editedListName, setEditedListName] = useState('');

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
      // Find the selected event to get its date
      const selectedEvent = events.find(event => event.id === newList.event_id);

      if (!selectedEvent) {
        alert('Please select a valid event');
        return;
      }

      const { error } = await supabase
        .from('guest_lists')
        .insert({
          event_id: newList.event_id,
          event_date: selectedEvent.date, // Include the event date
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
      alert(`Failed to create guest list: ${error.message || 'Unknown error'}`);
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

  const viewListDetails = (list) => {
    setSelectedList(list);
    fetchGuests(list.id);
    setShowCreateForm(false); // Close create form if open
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
          status: 'pending', // Promoters need approval from managers
          added_by: userProfile.id,
          tenant_id: userProfile.tenant_id,
        });

      if (error) {
        throw error;
      }

      alert('Guest added successfully (pending approval)');
      setShowAddGuestForm(false);
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

  const updateListName = async () => {
    if (!editedListName.trim()) {
      alert('List name cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('guest_lists')
        .update({ list_name: editedListName.trim() })
        .eq('id', selectedList.id);

      if (error) {
        throw error;
      }

      alert('List name updated successfully');
      setEditingListName(false);
      setSelectedList({ ...selectedList, list_name: editedListName.trim() });
      fetchGuestLists(); // Refresh the list
    } catch (error) {
      console.error('Error updating list name:', error);
      alert(`Failed to update list name: ${error.message}`);
    }
  };

  const startEditingListName = () => {
    setEditedListName(selectedList.list_name || '');
    setEditingListName(true);
  };

  const cancelEditingListName = () => {
    setEditingListName(false);
    setEditedListName('');
  };

  const checkInGuest = async (guestId) => {
    if (!canVerifyGuests(userProfile.role)) {
      alert('You do not have permission to check in guests');
      return;
    }

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

      fetchGuests(selectedList.id);
      fetchGuestLists();
      alert('Guest checked in');
    } catch (error) {
      console.error('Error checking in guest:', error);
      alert('Failed to check in guest');
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
    setShowAddGuestForm(false); // Close add form if open
  };

  const cancelEdit = () => {
    setEditingGuest(null);
    setGuestForm({ guest_name: '', guest_email: '', guest_phone: '', plus_ones: 0 });
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📋 My Guest Lists</h1>
          <p>Create and manage your guest lists</p>
          {selectedList ? (
            <button
              onClick={() => setSelectedList(null)}
              className="btn-secondary"
              style={{ marginTop: '10px' }}
            >
              ← Back to Lists
            </button>
          ) : canCreateLists(userProfile.role) ? (
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setSelectedList(null);
              }}
              className="btn-primary"
              style={{ marginTop: '10px' }}
            >
              {showCreateForm ? 'Cancel' : '+ Create New List'}
            </button>
          ) : null}
        </div>

        {/* Create Guest List Form */}
        {showCreateForm && !selectedList && (
          <div className="form-container" style={{ marginBottom: '20px' }}>
            <h3>Create New Guest List</h3>
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

        {/* Guest List Details View */}
        {selectedList ? (
          <div>
            <div className="info-box" style={{ marginBottom: '20px' }}>
              {editingListName ? (
                <div style={{ marginBottom: '15px' }}>
                  <div className="form-group">
                    <label>List Name:</label>
                    <input
                      type="text"
                      value={editedListName}
                      onChange={(e) => setEditedListName(e.target.value)}
                      placeholder="Enter list name"
                      autoFocus
                      style={{ marginBottom: '10px' }}
                    />
                  </div>
                  <button onClick={updateListName} className="btn-success" style={{ marginRight: '10px' }}>
                    Save
                  </button>
                  <button onClick={cancelEditingListName} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0 }}>{selectedList.list_name || 'Guest List'}</h3>
                  <button
                    onClick={startEditingListName}
                    className="btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.85em' }}
                    title="Edit list name"
                  >
                    ✏️ Edit
                  </button>
                </div>
              )}
              <p><strong>Event:</strong> {selectedList.events?.name || 'N/A'}</p>
              <p><strong>Total Guests:</strong> {selectedList.current_guest_count || 0} | <strong>Checked In:</strong> {selectedList.checked_in_count || 0}</p>
            </div>

            {/* Add Guest Button */}
            {canAddGuests(userProfile.role) && !editingGuest && (
              <button
                onClick={() => {
                  setShowAddGuestForm(!showAddGuestForm);
                  setEditingGuest(null);
                }}
                className="btn-success"
                style={{ marginBottom: '15px' }}
              >
                {showAddGuestForm ? 'Cancel' : '+ Add Guest'}
              </button>
            )}

            {/* Add Guest Form */}
            {showAddGuestForm && !editingGuest && (
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
                    onClick={() => setShowAddGuestForm(false)}
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

            {/* Guests Table */}
            {loadingGuests ? (
              <div className="loading">Loading guests...</div>
            ) : guests.length === 0 ? (
              <div className="info-box">No guests in this list yet. Add your first guest!</div>
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

                          {!canEditGuest(userProfile.role, userProfile.id, guest.added_by) &&
                           !canRemoveGuests(userProfile.role) &&
                           guest.checked_in && (
                            <span className="text-muted">—</span>
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
          /* Guest Lists Overview */
          <>
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestLists.map((list) => (
                      <tr key={list.id}>
                        <td>{list.list_name}</td>
                        <td>{list.events?.name || 'N/A'}</td>
                        <td>{list.current_guest_count || 0}</td>
                        <td>{list.checked_in_count || 0}</td>
                        <td>
                          <span className={`status-badge status-${list.status}`}>
                            {list.status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => viewListDetails(list)}
                            className="btn-primary"
                          >
                            Manage Guests
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
