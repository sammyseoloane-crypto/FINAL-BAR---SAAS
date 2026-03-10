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
        .select('*, transactions(amount, status, type, metadata, products(name, type))')
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

  const downloadQRCode = (qr, index = null) => {
    // Find the QR code SVG element
    const qrContainer = document.querySelector(`#qr-container-${qr.id}`)
    if (!qrContainer) return

    const svg = qrContainer.querySelector('svg')
    if (!svg) return

    // Get transaction details
    const itemName = getDisplayName(qr.transactions)
    const quantity = qr.transactions?.metadata?.quantity || 1
    const amount = qr.transactions?.amount || 0
    const createdDate = new Date(qr.created_at)

    // Create canvas with ticket layout
    const canvas = document.createElement('canvas')
    const width = 800
    const height = 1000
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#ee0979')
    gradient.addColorStop(1, '#ff6a00')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // White content area
    ctx.fillStyle = 'white'
    ctx.fillRect(40, 40, width - 80, height - 80)

    // Item name at top
    ctx.fillStyle = '#333'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'left'
    const nameY = 100
    wrapText(ctx, itemName.toUpperCase(), 60, nameY, width - 120, 40)

    // Product type badge
    const productType = getDisplayType(qr.transactions)
    ctx.fillStyle = '#667eea'
    ctx.fillRect(60, nameY + 60, 200, 40)
    ctx.fillStyle = 'white'
    ctx.font = '18px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(productType, 70, nameY + 88)

    // Venue indicator badge (ENTRANCE or COUNTER)
    // Prioritize metadata (source of truth from purchase time)
    const productTypeRaw = qr.transactions?.metadata?.product_type || qr.transactions?.products?.type
    const productName = qr.transactions?.metadata?.product_name || qr.transactions?.products?.name || ''
    console.log('Venue Badge - Product Type Raw:', productTypeRaw)
    console.log('Venue Badge - Product Name:', productName)
    console.log('Venue Badge - Metadata:', qr.transactions?.metadata)
    
    // Check if it's entrance fee by type OR by name (fallback for before migration)
    const isEntranceFee = productTypeRaw === 'entrance_fee' || 
                          productName.toLowerCase().includes('entrance')
    const venue = isEntranceFee ? 'ENTRANCE' : 'COUNTER'
    const venueColor = isEntranceFee ? '#48bb78' : '#ed8936'
    
    ctx.fillStyle = venueColor
    ctx.fillRect(width - 260, nameY + 60, 200, 40)
    ctx.fillStyle = 'white'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`📍 ${venue}`, width - 160, nameY + 88)

    // QR Code (centered)
    const qrSize = 350
    const qrX = (width - qrSize) / 2
    const qrY = 280
    
    // Convert SVG to image and draw
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize)
      
      // QR Code string below
      ctx.fillStyle = '#666'
      ctx.font = '14px Courier New'
      ctx.textAlign = 'center'
      ctx.fillText(qr.code.substring(0, 30), width / 2, qrY + qrSize + 30)
      ctx.fillText(qr.code.substring(30), width / 2, qrY + qrSize + 50)

      // Details section
      const detailsY = qrY + qrSize + 100
      ctx.textAlign = 'left'
      ctx.fillStyle = '#999'
      ctx.font = 'bold 16px Arial'
      
      // Amount
      ctx.fillText('AMOUNT', 60, detailsY)
      ctx.fillStyle = '#333'
      ctx.font = 'bold 24px Arial'
      ctx.fillText(`R ${parseFloat(amount).toFixed(2)}`, 60, detailsY + 30)

      // Date
      ctx.fillStyle = '#999'
      ctx.font = 'bold 16px Arial'
      ctx.fillText('PURCHASE DATE', width / 2 + 20, detailsY)
      ctx.fillStyle = '#333'
      ctx.font = 'bold 20px Arial'
      ctx.fillText(createdDate.toLocaleDateString(), width / 2 + 20, detailsY + 30)

      // Quantity indicator - different display for entrance vs products
      if (quantity > 1) {
        if (index !== null) {
          // Entrance fee - show ticket number
          ctx.fillStyle = '#667eea'
          ctx.font = 'bold 18px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(`🎫 Ticket ${index + 1} of ${quantity}`, width / 2, detailsY + 80)
        } else {
          // Drinks/Food - show total quantity on one ticket
          ctx.fillStyle = '#48bb78'
          ctx.font = 'bold 18px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(`📦 Quantity: ${quantity} items`, width / 2, detailsY + 80)
        }
      }

      // Footer with venue-specific instruction
      ctx.fillStyle = '#ccc'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      const instruction = productTypeRaw === 'entrance_fee' 
        ? '📍 Present this QR code at the ENTRANCE' 
        : '📍 Present this QR code at the COUNTER'
      ctx.fillText(instruction, width / 2, height - 60)

      // Download
      canvas.toBlob((blob) => {
        const link = document.createElement('a')
        const sanitizedName = itemName.replace(/[^a-z0-9]/gi, '_')
        // For entrance fees: ItemName_1of3.png, ItemName_2of3.png, etc.
        // For drinks/food: ItemName.png (quantity shown on ticket)
        const suffix = index !== null ? `_Ticket${index + 1}of${quantity}` : ''
        link.download = `${sanitizedName}${suffix}.png`
        link.href = URL.createObjectURL(blob)
        link.click()
        URL.revokeObjectURL(url)
      })
    }
    img.src = url
  }

  // Helper function to wrap text
  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(' ')
    let line = ''
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' '
      const metrics = ctx.measureText(testLine)
      const testWidth = metrics.width
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y)
        line = words[n] + ' '
        y += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, y)
  }

  // Download all QR codes for quantity > 1
  const downloadAllQRCodes = (qr) => {
    const quantity = qr.transactions?.metadata?.quantity || 1
    // Prioritize metadata (source of truth from purchase time)
    const productType = qr.transactions?.metadata?.product_type || qr.transactions?.products?.type
    const productName = qr.transactions?.metadata?.product_name || qr.transactions?.products?.name || ''
    
    // Debug logging
    console.log('Download QR - Product Type:', productType)
    console.log('Download QR - Product Name:', productName)
    console.log('Download QR - Metadata:', qr.transactions?.metadata)
    console.log('Download QR - Products:', qr.transactions?.products)
    console.log('Download QR - Quantity:', quantity)
    
    // Only entrance fees get separate QR codes per quantity
    // Drinks and food are grouped in one QR code (order-based)
    // Check by type OR name (fallback for before migration)
    const isEntranceFee = productType === 'entrance_fee' || 
                          productName.toLowerCase().includes('entrance')
    const shouldSeparate = isEntranceFee
    
    if (quantity <= 1 || !shouldSeparate) {
      downloadQRCode(qr)
    } else {
      // Download separate QR code for each entrance fee ticket
      for (let i = 0; i < quantity; i++) {
        setTimeout(() => downloadQRCode(qr, i), i * 500) // Delay to avoid browser blocking
      }
      alert(`Downloading ${quantity} entrance tickets. Please check your downloads folder.`)
    }
  }

  // Check if QR code has expired (24 hours after creation)
  const isExpired = (qrCode) => {
    const createdAt = new Date(qrCode.created_at)
    const now = new Date()
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60)
    return hoursSinceCreation > 24
  }

  // Check if QR code should be hidden (72 hours after creation = 24h active + 48h grace period)
  const shouldHide = (qrCode) => {
    const createdAt = new Date(qrCode.created_at)
    const now = new Date()
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60)
    return hoursSinceCreation > 72 // Hide after 72 hours total
  }

  // Calculate time remaining for active QR codes
  const getTimeRemaining = (qrCode) => {
    const createdAt = new Date(qrCode.created_at)
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
    const now = new Date()
    const msRemaining = expiresAt - now
    
    if (msRemaining <= 0) return 'Expired'
    
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60))
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hoursRemaining > 0) {
      return `${hoursRemaining}h ${minutesRemaining}m remaining`
    } else {
      return `${minutesRemaining}m remaining`
    }
  }

  // Calculate time until QR code will be removed (72 hours after creation)
  const getTimeUntilRemoval = (qrCode) => {
    const createdAt = new Date(qrCode.created_at)
    const removalAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000)
    const now = new Date()
    const msRemaining = removalAt - now
    
    if (msRemaining <= 0) return 'Will be removed soon'
    
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60))
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hoursRemaining > 0) {
      return `Will auto-remove in ${hoursRemaining}h ${minutesRemaining}m`
    } else {
      return `Will auto-remove in ${minutesRemaining}m`
    }
  }

  // Get display name for transaction (event or product)
  const getDisplayName = (transaction) => {
    // For event purchases (stored in metadata)
    if (transaction?.type === 'event_entry' && transaction?.metadata?.event_name) {
      return transaction.metadata.event_name
    }
    // For product purchases - check metadata first (has actual product name)
    if (transaction?.metadata?.product_name) {
      return transaction.metadata.product_name
    }
    // Fallback to products table
    if (transaction?.products?.name) {
      return transaction.products.name
    }
    return 'N/A'
  }

  // Get display type with icon
  const getDisplayType = (transaction) => {
    if (transaction?.type === 'event_entry') {
      return '🎉 Event Entry'
    }
    // Check product type from products table or metadata
    const productType = transaction?.products?.type || transaction?.metadata?.product_type
    if (productType === 'entrance_fee') {
      return '🎫 Entrance Fee'
    }
    if (productType === 'drink') {
      return '🍹 Drink Purchase'
    }
    if (productType === 'food') {
      return '🍔 Food Purchase'
    }
    return '🛒 Product Purchase'
  }

  // Filter QR codes - hide those older than 72 hours
  const visibleQRCodes = qrCodes.filter(qr => !shouldHide(qr))
  const activeQRCodes = visibleQRCodes.filter(qr => !qr.scanned_at && !isExpired(qr))
  const expiredQRCodes = visibleQRCodes.filter(qr => !qr.scanned_at && isExpired(qr))
  const usedQRCodes = visibleQRCodes.filter(qr => qr.scanned_at)

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
          <div className="stat-card" style={{ borderLeft: '3px solid #ed8936' }}>
            <div className="stat-value" style={{ color: '#ed8936' }}>{expiredQRCodes.length}</div>
            <div className="stat-label">Expired QR Codes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{usedQRCodes.length}</div>
            <div className="stat-label">Used QR Codes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{visibleQRCodes.length}</div>
            <div className="stat-label">Total Visible</div>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : visibleQRCodes.length === 0 ? (
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
                            onClick={() => downloadAllQRCodes(qr)}
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
                            📥 Download QR Code{
                              qr.transactions?.metadata?.quantity > 1 && 
                              (qr.transactions?.products?.type === 'entrance_fee' || qr.transactions?.metadata?.product_type === 'entrance_fee')
                              ? 's' : ''
                            }
                          </button>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                            <strong>Type:</strong> {getDisplayType(qr.transactions)}
                          </p>
                          <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                            <strong>Item:</strong> {getDisplayName(qr.transactions)}
                          </p>
                          {qr.transactions?.metadata?.quantity && (
                            <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                              <strong>Quantity:</strong> {qr.transactions.metadata.quantity}
                            </p>
                          )}
                          <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                            <strong>Amount:</strong> R {qr.transactions?.amount}
                          </p>
                        </div>

                        {qr.transactions?.metadata?.quantity > 1 && 
                         (qr.transactions?.products?.type === 'entrance_fee' || qr.transactions?.metadata?.product_type === 'entrance_fee') && (
                          <div style={{ 
                            background: '#fff3cd', 
                            padding: '10px', 
                            borderRadius: '4px',
                            fontSize: '0.85em',
                            marginBottom: '10px',
                            border: '1px solid #ffc107',
                            color: '#856404'
                          }}>
                            🎫 Downloading will create {qr.transactions.metadata.quantity} separate entrance tickets (one per person)
                          </div>
                        )}

                        <div style={{ 
                          background: '#e6fffa', 
                          padding: '10px', 
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          marginBottom: '10px',
                          border: '1px solid #38b2ac',
                          color: '#234e52'
                        }}>
                          ⏰ <strong>{getTimeRemaining(qr)}</strong> (valid for 24 hours)
                        </div>

                        <div style={{ 
                          background: '#fff3cd', 
                          padding: '10px', 
                          borderRadius: '4px',
                          fontSize: '0.85em'
                        }}>
                          💡 Show this code to staff at the entrance or counter
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {expiredQRCodes.length > 0 && (
              <>
                <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#ed8936' }}>
                  ⏰ Expired QR Codes
                </h3>
                <div className="grid-2">
                  {expiredQRCodes.map((qr) => (
                    <div key={qr.id} className="card" style={{ 
                      borderLeft: '4px solid #ed8936',
                      background: '#fffaf0',
                      opacity: 0.85
                    }}>
                      <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                          <span className="status-badge" style={{ 
                            background: '#ed8936',
                            color: 'white',
                            fontWeight: '700'
                          }}>
                            ⏰ EXPIRED
                          </span>
                          <span style={{ fontSize: '0.85em', color: '#666' }}>
                            {new Date(qr.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div 
                          id={`qr-container-expired-${qr.id}`}
                          style={{ 
                            textAlign: 'center', 
                            padding: '20px', 
                            background: '#feebc8', 
                            borderRadius: '8px',
                            marginBottom: '15px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '15px',
                            position: 'relative',
                            opacity: 0.6
                          }}
                        >
                          <QRCodeGenerator value={qr.code} size={200} />
                          
                          {/* EXPIRED overlay */}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%) rotate(-15deg)',
                            background: 'rgba(237, 137, 54, 0.95)',
                            color: 'white',
                            padding: '15px 35px',
                            fontSize: '1.6em',
                            fontWeight: '900',
                            borderRadius: '8px',
                            border: '4px solid #dd6b20',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            letterSpacing: '2px'
                          }}>
                            EXPIRED
                          </div>

                          <div style={{ 
                            fontSize: '0.7em', 
                            fontFamily: 'monospace', 
                            color: '#999',
                            wordBreak: 'break-all',
                            maxWidth: '100%',
                            padding: '8px',
                            background: '#fff',
                            borderRadius: '4px',
                            textDecoration: 'line-through'
                          }}>
                            {qr.code}
                          </div>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                            <strong>Type:</strong> {getDisplayType(qr.transactions)}
                          </p>
                          <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                            <strong>Item:</strong> {getDisplayName(qr.transactions)}
                          </p>
                          {qr.transactions?.metadata?.quantity && (
                            <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                              <strong>Quantity:</strong> {qr.transactions.metadata.quantity}
                            </p>
                          )}
                          <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                            <strong>Amount:</strong> R {qr.transactions?.amount}
                          </p>
                        </div>

                        <div style={{ 
                          background: '#feebc8', 
                          padding: '10px', 
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          marginTop: '15px',
                          color: '#7c2d12',
                          border: '1px solid #ed8936'
                        }}>
                          <strong>⚠️ This QR code expired after 24 hours</strong><br />
                          Created: {new Date(qr.created_at).toLocaleString()}<br />
                          <strong>🗑️ {getTimeUntilRemoval(qr)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {usedQRCodes.length > 0 && (
              <>
                <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#e53e3e' }}>
                  🔒 Used QR Codes
                </h3>
                <div className="grid-2">
                  {usedQRCodes.map((qr) => (
                    <div key={qr.id} className="card" style={{ 
                      borderLeft: '4px solid #e53e3e',
                      background: '#fff5f5',
                      opacity: 0.85
                    }}>
                      <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                          <span className="status-badge" style={{ 
                            background: '#e53e3e',
                            color: 'white',
                            fontWeight: '700'
                          }}>
                            ❌ USED
                          </span>
                          <span style={{ fontSize: '0.85em', color: '#666' }}>
                            {new Date(qr.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div 
                          id={`qr-container-${qr.id}`}
                          style={{ 
                            textAlign: 'center', 
                            padding: '20px', 
                            background: '#fee', 
                            borderRadius: '8px',
                            marginBottom: '15px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '15px',
                            position: 'relative',
                            opacity: 0.7
                          }}
                        >
                          <QRCodeGenerator value={qr.code} size={200} />
                          
                          {/* USED overlay */}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%) rotate(-15deg)',
                            background: 'rgba(229, 62, 62, 0.95)',
                            color: 'white',
                            padding: '15px 40px',
                            fontSize: '1.8em',
                            fontWeight: '900',
                            borderRadius: '8px',
                            border: '4px solid #c53030',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            letterSpacing: '3px'
                          }}>
                            USED
                          </div>

                          <div style={{ 
                            fontSize: '0.7em', 
                            fontFamily: 'monospace', 
                            color: '#999',
                            wordBreak: 'break-all',
                            maxWidth: '100%',
                            padding: '8px',
                            background: '#fff',
                            borderRadius: '4px',
                            textDecoration: 'line-through'
                          }}>
                            {qr.code}
                          </div>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                            <strong>Type:</strong> {getDisplayType(qr.transactions)}
                          </p>
                          <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                            <strong>Item:</strong> {getDisplayName(qr.transactions)}
                          </p>
                          {qr.transactions?.metadata?.quantity && (
                            <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                              <strong>Quantity:</strong> {qr.transactions.metadata.quantity}
                            </p>
                          )}
                          <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                            <strong>Amount:</strong> R {qr.transactions?.amount}
                          </p>
                        </div>

                        <div style={{ 
                          background: '#fed7d7', 
                          padding: '10px', 
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          marginTop: '15px',
                          color: '#742a2a',
                          border: '1px solid #fc8181'
                        }}>
                          <strong>✓ Scanned:</strong> {new Date(qr.scanned_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
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
              <li><strong>⏰ QR codes are valid for 24 hours only</strong> - use them promptly!</li>
              <li>Show the QR code to staff at the entrance or service counter</li>
              <li>Staff will scan your code to verify and grant access/service</li>
              <li>Once scanned, the code moves to "Used" section</li>
              <li>Each QR code can only be used once for security</li>
              <li>Expired codes cannot be scanned - please contact support if needed</li>
              <li><strong>🗑️ Old QR codes are automatically removed after 48 hours of expiring</strong> (72 hours total)</li>
            </ol>
            
            <div style={{ 
              marginTop: '20px',
              padding: '15px',
              background: '#edf2f7',
              borderRadius: '8px',
              fontSize: '0.9em',
              borderLeft: '4px solid #4299e1'
            }}>
              <strong>💡 Timeline:</strong>
              <ul style={{ marginTop: '10px', marginBottom: '0', paddingLeft: '20px' }}>
                <li><strong>0-24 hours:</strong> Active & scannable ✅</li>
                <li><strong>24-72 hours:</strong> Expired but visible ⏰</li>
                <li><strong>After 72 hours:</strong> Automatically removed 🗑️</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
