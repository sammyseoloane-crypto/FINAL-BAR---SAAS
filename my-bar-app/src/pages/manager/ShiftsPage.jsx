import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function ManagerShiftsPage() {
  const { userProfile } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShift, setNewShift] = useState({
    user_id: '',
    start_time: '',
    end_time: '',
    shift_type: 'regular',
    break_duration: 30,
  });

  useEffect(() => {
    fetchShifts();
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchStaff = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('tenant_id', userProfile.tenant_id)
        .in('role', ['staff', 'manager']);

      if (error) {
        throw error;
      }
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchShifts = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const today = new Date();
      today.setDate(today.getDate() - 7); // Last 7 days

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('start_time', today.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        throw error;
      }

      // Fetch profiles for the user_ids in shifts
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(shift => shift.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Merge profiles into shifts
        const shiftsWithProfiles = data.map(shift => ({
          ...shift,
          profiles: profilesData?.find(p => p.id === shift.user_id) || null,
        }));

        setShifts(shiftsWithProfiles);
      } else {
        setShifts(data || []);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddShift = async (e) => {
    e.preventDefault();

    if (!userProfile?.tenant_id || !newShift.user_id || !newShift.start_time || !newShift.end_time) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .insert([{
          tenant_id: userProfile.tenant_id,
          user_id: newShift.user_id,
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          shift_type: newShift.shift_type,
          break_duration: parseInt(newShift.break_duration),
          status: 'scheduled',
          created_by: userProfile.id,
        }]);

      if (error) {
        throw error;
      }

      alert('Shift created successfully');
      setShowAddShift(false);
      setNewShift({
        user_id: '',
        start_time: '',
        end_time: '',
        shift_type: 'regular',
        break_duration: 30,
      });
      fetchShifts();
    } catch (error) {
      console.error('Error creating shift:', error);
      alert('Failed to create shift');
    }
  };

  const updateShiftStatus = async (shiftId, newStatus) => {
    try {
      const { error } = await supabase
        .from('shifts')
        .update({ status: newStatus })
        .eq('id', shiftId);

      if (error) {
        throw error;
      }
      fetchShifts();
      alert(`Shift ${newStatus}`);
    } catch (error) {
      console.error('Error updating shift:', error);
      alert('Failed to update shift');
    }
  };

  const deleteShift = async (shiftId) => {
    if (!confirm('Are you sure you want to delete this shift?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId);

      if (error) {
        throw error;
      }
      fetchShifts();
      alert('Shift deleted');
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('Failed to delete shift');
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📅 Staff Shifts</h1>
          <p>Manage staff schedules and shifts</p>
          <button
            onClick={() => setShowAddShift(!showAddShift)}
            className="btn-primary"
            style={{ marginTop: '10px' }}
          >
            {showAddShift ? 'Cancel' : '+ Add Shift'}
          </button>
        </div>

        {showAddShift && (
          <div className="form-container" style={{ marginBottom: '20px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
            <h3>Create New Shift</h3>
            <form onSubmit={handleAddShift}>
              <div className="form-group">
                <label>Staff Member *</label>
                <select
                  value={newShift.user_id}
                  onChange={(e) => setNewShift({ ...newShift, user_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">Select staff member...</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Start Time *</label>
                <input
                  type="datetime-local"
                  value={newShift.start_time}
                  onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              <div className="form-group">
                <label>End Time *</label>
                <input
                  type="datetime-local"
                  value={newShift.end_time}
                  onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              <div className="form-group">
                <label>Shift Type</label>
                <select
                  value={newShift.shift_type}
                  onChange={(e) => setNewShift({ ...newShift, shift_type: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="regular">Regular</option>
                  <option value="overtime">Overtime</option>
                  <option value="split">Split</option>
                </select>
              </div>

              <div className="form-group">
                <label>Break Duration (minutes)</label>
                <input
                  type="number"
                  value={newShift.break_duration}
                  onChange={(e) => setNewShift({ ...newShift, break_duration: e.target.value })}
                  min="0"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              <button type="submit" className="btn-primary">Create Shift</button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="info-box">
            <p>No shifts scheduled. Click &quot;Add Shift&quot; to create one.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Date</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Type</th>
                  <th>Break (min)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td>{shift.profiles?.full_name || shift.profiles?.email || 'N/A'}</td>
                    <td>{new Date(shift.start_time).toLocaleDateString()}</td>
                    <td>{new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className={`badge badge-${shift.shift_type}`}>
                        {shift.shift_type}
                      </span>
                    </td>
                    <td>{shift.break_duration || 0}</td>
                    <td>
                      <span className={`status-badge status-${shift.status}`}>
                        {shift.status}
                      </span>
                    </td>
                    <td>
                      {shift.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => updateShiftStatus(shift.id, 'cancelled')}
                            className="btn-warning"
                            style={{ marginRight: '5px' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => deleteShift(shift.id)}
                            className="btn-danger"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="info-box" style={{ marginTop: '20px' }}>
          <strong>ℹ️ Shift Management:</strong>
          <ul>
            <li>✅ Create shifts for staff members</li>
            <li>✅ Schedule regular, overtime, and split shifts</li>
            <li>✅ Cancel or delete scheduled shifts</li>
            <li>✅ View shift history and upcoming schedule</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
