import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './SupportPanel.css';

/**
 * Admin Support Panel Component
 * Dashboard for viewing and managing support tickets
 */
const SupportPanel = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          user_profiles (
            user_id,
            role,
            tenants (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (error) {
        throw error;
      }

      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      alert('Failed to update ticket status');
    }
  };

  const addResponse = async (ticketId) => {
    if (!response.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update ticket with response
      const { error } = await supabase
        .from('support_tickets')
        .update({
          admin_response: response,
          admin_responder_id: user?.id,
          responded_at: new Date().toISOString(),
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (error) {
        throw error;
      }

      // TODO: Send email notification to user

      setResponse('');
      await loadTickets();
      alert('Response added successfully!');
    } catch (error) {
      console.error('Error adding response:', error);
      alert('Failed to add response');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#daa520';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getSeverityBadge = (severity) => {
    const color = getSeverityColor(severity);
    return (
      <span className="severity-badge" style={{ backgroundColor: color }}>
        {severity?.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const colors = {
      open: '#d4af37',
      in_progress: '#f59e0b',
      resolved: '#10b981',
      closed: '#6b7280',
    };

    return (
      <span className="status-badge" style={{ backgroundColor: colors[status] || '#6b7280' }}>
        {status?.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const getTypeIcon = (type) => {
    const icons = {
      bug: '🐛',
      feature: '💡',
      performance: '⚡',
      usability: '🎨',
      security: '🔒',
      other: '❓',
    };
    return icons[type] || '📝';
  };

  const filteredTickets = tickets;

  return (
    <div className="support-panel">
      <div className="panel-header">
        <h1>🎫 Support Tickets</h1>
        <p>Manage customer support requests and bug reports</p>
      </div>

      <div className="panel-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Tickets ({tickets.length})
        </button>
        <button
          className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
          onClick={() => setFilter('open')}
        >
          Open ({tickets.filter(t => t.status === 'open').length})
        </button>
        <button
          className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setFilter('in_progress')}
        >
          In Progress ({tickets.filter(t => t.status === 'in_progress').length})
        </button>
        <button
          className={`filter-btn ${filter === 'resolved' ? 'active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          Resolved ({tickets.filter(t => t.status === 'resolved').length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading tickets...</div>
      ) : (
        <div className="panel-content">
          <div className="tickets-list">
            {filteredTickets.length === 0 ? (
              <div className="no-tickets">
                <span className="empty-icon">📭</span>
                <p>No tickets found</p>
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className={`ticket-card ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="ticket-header-row">
                    <div className="ticket-type">
                      <span className="type-icon">{getTypeIcon(ticket.type)}</span>
                      <span className="type-name">{ticket.type}</span>
                    </div>
                    {getSeverityBadge(ticket.severity)}
                  </div>

                  <h3 className="ticket-title">{ticket.title}</h3>

                  <div className="ticket-meta">
                    <span className="meta-item">
                      👤 {ticket.user_email}
                    </span>
                    {ticket.user_profiles?.tenants?.name && (
                      <span className="meta-item">
                        🏢 {ticket.user_profiles.tenants.name}
                      </span>
                    )}
                    <span className="meta-item">
                      🕒 {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="ticket-status-row">
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedTicket && (
            <div className="ticket-details">
              <div className="details-header">
                <div>
                  <h2>{selectedTicket.title}</h2>
                  <div className="details-meta">
                    <span>{getTypeIcon(selectedTicket.type)} {selectedTicket.type}</span>
                    <span>•</span>
                    <span>Submitted by {selectedTicket.user_email}</span>
                    <span>•</span>
                    <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  className="close-details"
                  onClick={() => setSelectedTicket(null)}
                >
                  ✕
                </button>
              </div>

              <div className="details-body">
                <div className="detail-section">
                  <h3>Description</h3>
                  <p>{selectedTicket.description}</p>
                </div>

                {selectedTicket.steps_to_reproduce && (
                  <div className="detail-section">
                    <h3>Steps to Reproduce</h3>
                    <pre>{selectedTicket.steps_to_reproduce}</pre>
                  </div>
                )}

                {selectedTicket.expected_behavior && (
                  <div className="detail-section">
                    <h3>Expected Behavior</h3>
                    <p>{selectedTicket.expected_behavior}</p>
                  </div>
                )}

                {selectedTicket.actual_behavior && (
                  <div className="detail-section">
                    <h3>Actual Behavior</h3>
                    <p>{selectedTicket.actual_behavior}</p>
                  </div>
                )}

                <div className="detail-section">
                  <h3>Technical Information</h3>
                  <div className="tech-info">
                    <div className="info-item">
                      <strong>URL:</strong> {selectedTicket.metadata?.url || 'Not recorded'}
                    </div>
                    <div className="info-item">
                      <strong>Browser:</strong> {selectedTicket.metadata?.userAgent?.split(' ').slice(0, 3).join(' ') || 'Unknown'}
                    </div>
                    <div className="info-item">
                      <strong>Viewport:</strong> {selectedTicket.metadata?.viewport ?
                        `${selectedTicket.metadata.viewport.width}x${selectedTicket.metadata.viewport.height}` :
                        'Unknown'}
                    </div>
                  </div>
                </div>

                {selectedTicket.admin_response && (
                  <div className="detail-section admin-response">
                    <h3>Admin Response</h3>
                    <p>{selectedTicket.admin_response}</p>
                    <div className="response-meta">
                      Responded on {new Date(selectedTicket.responded_at).toLocaleString()}
                    </div>
                  </div>
                )}

                <div className="detail-section">
                  <h3>Add Response</h3>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Type your response to the user..."
                    rows={4}
                    className="response-textarea"
                  />
                  <button
                    onClick={() => addResponse(selectedTicket.id)}
                    disabled={!response.trim() || submitting}
                    className="btn-send-response"
                  >
                    {submitting ? 'Sending...' : '📧 Send Response'}
                  </button>
                </div>

                <div className="detail-section">
                  <h3>Update Status</h3>
                  <div className="status-buttons">
                    <button
                      onClick={() => updateTicketStatus(selectedTicket.id, 'open')}
                      className="status-btn open"
                      disabled={selectedTicket.status === 'open'}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                      className="status-btn in-progress"
                      disabled={selectedTicket.status === 'in_progress'}
                    >
                      In Progress
                    </button>
                    <button
                      onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                      className="status-btn resolved"
                      disabled={selectedTicket.status === 'resolved'}
                    >
                      Resolved
                    </button>
                    <button
                      onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                      className="status-btn closed"
                      disabled={selectedTicket.status === 'closed'}
                    >
                      Closed
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SupportPanel;
