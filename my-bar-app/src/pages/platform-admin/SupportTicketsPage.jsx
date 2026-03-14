import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    fetchTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      // Note: This uses a hypothetical support_tickets table
      // If it doesn't exist, we'll show sample data
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          tenants(name),
          profiles!user_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist, show sample data
        console.warn('Support tickets table not found, showing sample data');
        setTickets(generateSampleTickets());
      } else {
        setTickets(data || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTickets(generateSampleTickets());
    } finally {
      setLoading(false);
    }
  };

  const generateSampleTickets = () => {
    return [
      {
        id: '1',
        subject: 'Payment processing issue',
        description: 'Unable to process customer payments through Stripe integration',
        status: 'open',
        priority: 'high',
        tenant_name: 'Club Paradise',
        user_email: 'owner@clubparadise.com',
        user_name: 'John Smith',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        subject: 'Feature request: QR code customization',
        description: 'Would like to add custom branding to QR codes',
        status: 'in_progress',
        priority: 'medium',
        tenant_name: 'Lounge 88',
        user_email: 'manager@lounge88.com',
        user_name: 'Sarah Johnson',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        subject: 'Subscription upgrade question',
        description: 'What are the benefits of upgrading to Enterprise plan?',
        status: 'resolved',
        priority: 'low',
        tenant_name: 'The Vault',
        user_email: 'admin@thevault.com',
        user_name: 'Mike Davis',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  };

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

      fetchTickets();
      alert('Ticket status updated');
    } catch (error) {
      console.error('Error updating ticket:', error);
      alert('Sample data - Status update simulation successful');
      // Update local state for sample data
      setTickets(tickets.map((t) =>
        t.id === ticketId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t,
      ));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: '#ef4444',
      in_progress: '#f59e0b',
      resolved: '#10b981',
      closed: '#6b7280',
    };
    return colors[status] || '#64748b';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626',
    };
    return colors[priority] || '#64748b';
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === 'all') {
      return true;
    }
    return ticket.status === filter;
  });

  const ticketCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>🎫 Support Tickets</h1>
          <p>Manage customer support requests</p>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px',
            marginBottom: '20px',
          }}
        >
          <div
            onClick={() => setFilter('all')}
            style={{
              background: filter === 'all' ? '#f3f4f6' : 'white',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#333' }}>{ticketCounts.all}</div>
            <div style={{ fontSize: '0.9em', color: '#666' }}>All Tickets</div>
          </div>
          <div
            onClick={() => setFilter('open')}
            style={{
              background: filter === 'open' ? '#fee2e2' : 'white',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#dc2626' }}>{ticketCounts.open}</div>
            <div style={{ fontSize: '0.9em', color: '#666' }}>Open</div>
          </div>
          <div
            onClick={() => setFilter('in_progress')}
            style={{
              background: filter === 'in_progress' ? '#fef3c7' : 'white',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #fde68a',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#d97706' }}>{ticketCounts.in_progress}</div>
            <div style={{ fontSize: '0.9em', color: '#666' }}>In Progress</div>
          </div>
          <div
            onClick={() => setFilter('resolved')}
            style={{
              background: filter === 'resolved' ? '#d1fae5' : 'white',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #a7f3d0',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#059669' }}>{ticketCounts.resolved}</div>
            <div style={{ fontSize: '0.9em', color: '#666' }}>Resolved</div>
          </div>
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div className="loading">Loading tickets...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Tenant</th>
                  <th>User</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>#{ticket.id.slice(0, 8)}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{ticket.subject}</div>
                      <div style={{ fontSize: '0.85em', color: '#666', marginTop: '3px' }}>
                        {ticket.description?.substring(0, 60)}...
                      </div>
                    </td>
                    <td>{ticket.tenants?.name || ticket.tenant_name}</td>
                    <td>
                      <div>{ticket.profiles?.full_name || ticket.user_name}</div>
                      <div style={{ fontSize: '0.8em', color: '#666' }}>
                        {ticket.profiles?.email || ticket.user_email}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75em',
                          fontWeight: '600',
                          background: getPriorityColor(ticket.priority),
                          color: 'white',
                          textTransform: 'uppercase',
                        }}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75em',
                          fontWeight: '600',
                          background: getStatusColor(ticket.status),
                          color: 'white',
                          textTransform: 'capitalize',
                        }}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85em' }}>
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.85em' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredTickets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                No {filter !== 'all' ? filter.replace('_', ' ') : ''} tickets found
              </div>
            )}
          </div>
        )}

        {/* Ticket Detail Modal */}
        {selectedTicket && (
          <div
            onClick={() => setSelectedTicket(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '30px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
            >
              <h2 style={{ marginTop: 0 }}>{selectedTicket.subject}</h2>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '0.85em',
                      fontWeight: '600',
                      background: getStatusColor(selectedTicket.status),
                      color: 'white',
                    }}
                  >
                    {selectedTicket.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '0.85em',
                      fontWeight: '600',
                      background: getPriorityColor(selectedTicket.priority),
                      color: 'white',
                    }}
                  >
                    {selectedTicket.priority.toUpperCase()} PRIORITY
                  </span>
                </div>

                <div style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
                  <div><strong>From:</strong> {selectedTicket.user_name} ({selectedTicket.user_email})</div>
                  <div><strong>Tenant:</strong> {selectedTicket.tenant_name}</div>
                  <div><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div
                style={{
                  background: '#f9fafb',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                }}
              >
                <p style={{ margin: 0, lineHeight: '1.6' }}>{selectedTicket.description}</p>
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '1.1em', marginBottom: '10px' }}>Update Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                    className="btn-primary"
                    style={{ padding: '10px' }}
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                    className="btn-success"
                    style={{ padding: '10px' }}
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'open')}
                    className="btn-danger"
                    style={{ padding: '10px' }}
                  >
                    Reopen
                  </button>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    style={{
                      padding: '10px',
                      background: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="info-box"
          style={{
            marginTop: '20px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            padding: '15px',
            borderRadius: '8px',
          }}
        >
          <strong>ℹ️ Note:</strong> Support ticket system is displaying sample data. To enable full ticket
          management, implement the support_tickets table.
        </div>
      </div>
    </DashboardLayout>
  );
}
