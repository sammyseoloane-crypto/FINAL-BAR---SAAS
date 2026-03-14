import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function PromoterEventsPage() {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchEvents = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('active', true)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>🎉 Upcoming Events</h1>
          <p>View events you can promote</p>
        </div>

        {loading ? (
          <div className="loading">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="info-box">
            <p>No upcoming events available.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td><strong>{event.name}</strong></td>
                    <td>{new Date(event.date).toLocaleDateString()}</td>
                    <td>
                      {event.start_time && event.end_time
                        ? `${event.start_time} - ${event.end_time}`
                        : 'TBD'}
                    </td>
                    <td>{event.location || 'TBD'}</td>
                    <td style={{ maxWidth: '300px' }}>
                      {event.description || 'No description'}
                    </td>
                    <td>
                      <span className={`status-badge status-${event.active ? 'active' : 'inactive'}`}>
                        {event.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="info-box" style={{ marginTop: '20px' }}>
          <strong>💡 Tips for Promoters:</strong>
          <ul>
            <li>Create guest lists for upcoming events</li>
            <li>Invite more guests to increase your commission</li>
            <li>Track attendance and earnings on the Commission page</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
