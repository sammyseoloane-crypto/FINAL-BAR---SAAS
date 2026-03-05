import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import QRCodeGenerator from '../../components/QRCodeGenerator'
import '../owner/Pages.css'

export default function QRCodesPage() {
  const { user } = useAuth()
  const [qrCodes, setQrCodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQRCodes()
  }, [])

  const fetchQRCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_codes')
        .select('*, transactions(amount, status, type, metadata, products(name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setQrCodes(data || [])
    } catch (error) {
      console.error('Error fetching QR codes:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadQRCode = (qrId, qrCode) => {
    // Find the QR code SVG element
    const qrContainer = document.querySelector(`#qr-container-${qrId}`)
    if (!qrContainer) return

    const svg = qrContainer.querySelector('svg')
    if (!svg) return

    // Create canvas
    const canvas = document.createElement('canvas')
    const size = 400 // Higher resolution for download
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // White background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, size, size)

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      
      // Download
      canvas.toBlob((blob) => {
        const link = document.createElement('a')
        link.download = `qr-code-${qrId.substring(0, 8)}.png`
        link.href = URL.createObjectURL(blob)
        link.click()
        URL.revokeObjectURL(url)
      })
    }
    img.src = url
  }

  const activeQRCodes = qrCodes.filter(qr => !qr.scanned_at)
  const usedQRCodes = qrCodes.filter(qr => qr.scanned_at)

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>🎫 My QR Codes</h2>
          <p>Access your entry passes and receipts</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{activeQRCodes.length}</div>
            <div className="stat-label">Active QR Codes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{usedQRCodes.length}</div>
            <div className="stat-label">Used QR Codes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{qrCodes.length}</div>
            <div className="stat-label">Total Generated</div>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : qrCodes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📱</div>
            <h3>No QR Codes Yet</h3>
            <p>Complete a payment to receive your first QR code</p>
          </div>
        ) : (
          <>
            {activeQRCodes.length > 0 && (
              <>
                <h3 style={{ marginBottom: '15px', color: '#667eea' }}>✅ Active QR Codes</h3>
                <div className="grid-2">
                  {activeQRCodes.map((qr) => (
                    <div key={qr.id} className="card" style={{ borderLeft: '4px solid #48bb78' }}>
                      <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                          <span className="status-badge status-completed">Active</span>
                          <span style={{ fontSize: '0.85em', color: '#666' }}>
                            {new Date(qr.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div 
                          id={`qr-container-${qr.id}`}
                          style={{ 
                            textAlign: 'center', 
                            padding: '20px', 
                            background: '#f7fafc', 
                            borderRadius: '8px',
                            marginBottom: '15px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '15px'
                          }}
                        >
                          <QRCodeGenerator value={qr.code} size={200} />
                          <div style={{ 
                            fontSize: '0.7em', 
                            fontFamily: 'monospace', 
                            color: '#666',
                            wordBreak: 'break-all',
                            maxWidth: '100%',
                            padding: '8px',
                            background: '#fff',
                            borderRadius: '4px'
                          }}>
                            {qr.code}
                          </div>
                          <button
                            onClick={() => downloadQRCode(qr.id, qr.code)}
                            style={{ 
                              padding: '10px 20px',
                              fontSize: '0.9em',
                              background: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = '#5568d3'}
                            onMouseOut={(e) => e.target.style.background = '#667eea'}
                          >
                            📥 Download QR Code
                          </button>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                            <strong>Type:</strong> {qr.transactions?.type === 'event_entry' ? '🎉 Event Entry' : '🍹 Product Purchase'}
                          </p>
                          <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                            <strong>Item:</strong> {qr.transactions?.products?.name || qr.transactions?.metadata?.event_name || 'N/A'}
                          </p>
                          <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                            <strong>Amount:</strong> R {qr.transactions?.amount}
                          </p>
                        </div>

                        <div style={{ 
                          background: '#fff3cd', 
                          padding: '10px', 
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          marginTop: '15px'
                        }}>
                          💡 Show this code to staff at the entrance or counter
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {usedQRCodes.length > 0 && (
              <>
                <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#a0aec0' }}>
                  🔒 Used QR Codes
                </h3>
                <div className="card">
                  <div className="card-body">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Type</th>
                          <th>Item</th>
                          <th>Amount</th>
                          <th>Scanned At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usedQRCodes.map((qr) => (
                          <tr key={qr.id}>
                            <td><code>{qr.code}</code></td>
                            <td>
                              {qr.transactions?.type === 'event_entry' ? '🎉 Event Entry' : '🍹 Product'}
                            </td>
                            <td>
                              {qr.transactions?.products?.name || qr.transactions?.metadata?.event_name || 'N/A'}
                            </td>
                            <td>R {qr.transactions?.amount}</td>
                            <td>{qr.scanned_at ? new Date(qr.scanned_at).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="card">
          <div className="card-header">
            <h3>ℹ️ How to Use Your QR Code</h3>
          </div>
          <div className="card-body">
            <ol style={{ lineHeight: '1.8' }}>
              <li>After payment confirmation, your QR code appears here automatically</li>
              <li>Show the QR code to staff at the entrance or service counter</li>
              <li>Staff will scan your code to verify and grant access/service</li>
              <li>Once scanned, the code moves to "Used" section</li>
              <li>Each QR code can only be used once for security</li>
            </ol>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
