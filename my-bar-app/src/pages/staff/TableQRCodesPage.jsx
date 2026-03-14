import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import QRCode from 'qrcode';
import './TableQRCodesPage.css';

export default function TableQRCodesPage() {
  const { userProfile } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('table_qr_codes')
        .select('*')
        .order('table_name');

      if (error) {
        throw error;
      }

      setTables(data || []);
    } catch (error) {
      console.error('Error loading tables:', error);
      alert('Error loading QR codes');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCodeImage = async (qrUrl) => {
    try {
      const fullUrl = `${window.location.origin}${qrUrl}`;
      const qrDataUrl = await QRCode.toDataURL(fullUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };

  const handleDownloadQR = async (table) => {
    try {
      const qrImageUrl = await generateQRCodeImage(table.qr_url);
      if (!qrImageUrl) {
        alert('Error generating QR code');
        return;
      }

      // Download the QR code
      const link = document.createElement('a');
      link.href = qrImageUrl;
      link.download = `QR-${table.table_name.replace(/\s+/g, '-')}-${table.qr_token}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      alert('Error downloading QR code');
    }
  };

  const handlePrintQR = async (table) => {
    try {
      const qrImageUrl = await generateQRCodeImage(table.qr_url);
      if (!qrImageUrl) {
        alert('Error generating QR code');
        return;
      }

      // Open print dialog with QR code
      const printWindow = window.open('', '', 'width=600,height=600');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print QR Code - ${table.table_name}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              text-align: center;
            }
            .qr-container {
              max-width: 400px;
              margin: 0 auto;
              padding: 30px;
              border: 2px solid #000;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            .venue-name {
              font-size: 18px;
              color: #666;
              margin-bottom: 20px;
            }
            img {
              width: 100%;
              max-width: 300px;
              height: auto;
            }
            .instructions {
              margin-top: 20px;
              font-size: 14px;
              color: #333;
            }
            .token {
              font-size: 20px;
              font-weight: bold;
              margin-top: 15px;
              letter-spacing: 2px;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>${table.table_name}</h1>
            <div class="venue-name">${table.tenant_name}</div>
            <img src="${qrImageUrl}" alt="QR Code" />
            <div class="instructions">
              <p><strong>Open Your Bar Tab</strong></p>
              <p>Scan to start your tab</p>
            </div>
            <div class="token">${table.qr_token}</div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      console.error('Error printing QR code:', error);
      alert('Error printing QR code');
    }
  };

  const handleRegenerateQR = async (tableId, tableName) => {
    if (!confirm(`Regenerate QR code for ${tableName}?\n\nThe old QR code will stop working.`)) {
      return;
    }

    try {
      setRegenerating(tableId);

      const { data, error } = await supabase
        .rpc('regenerate_table_qr_token', {
          p_table_id: tableId,
        });

      if (error) {
        throw error;
      }

      alert(`New QR code generated!\nToken: ${data}`);

      // Reload tables
      await loadTables();
    } catch (error) {
      console.error('Error regenerating QR code:', error);
      alert('Error regenerating QR code');
    } finally {
      setRegenerating(null);
    }
  };

  const canManageQR = () => {
    return ['owner', 'manager', 'platform_admin'].includes(userProfile?.role);
  };

  if (loading) {
    return (
      <div className="table-qr-page">
        <div className="loading">Loading QR codes...</div>
      </div>
    );
  }

  return (
    <div className="table-qr-page">
      <div className="page-header">
        <h1>📱 Table QR Codes</h1>
        <p>Manage permanent QR codes for bar tabs</p>
      </div>

      {tables.length === 0 ? (
        <div className="empty-state">
          <p>No tables found. Create tables first in venue settings.</p>
        </div>
      ) : (
        <div className="qr-grid">
          {tables.map((table) => (
            <div key={table.table_id} className="qr-card">
              <div className="qr-card-header">
                <h3>{table.table_name}</h3>
                {table.zone && <span className="zone-badge">{table.zone}</span>}
                <span className={`status-badge ${table.status}`}>
                  {table.status}
                </span>
              </div>

              <div className="qr-preview">
                <QRCodeDisplay qrUrl={table.qr_url} />
              </div>

              <div className="qr-info">
                <div className="info-row">
                  <span className="label">Token:</span>
                  <span className="value token-value">{table.qr_token}</span>
                </div>
                <div className="info-row">
                  <span className="label">URL:</span>
                  <span className="value url-value">{table.qr_url}</span>
                </div>
                <div className="info-row">
                  <span className="label">Type:</span>
                  <span className="value">{table.table_type}</span>
                </div>
                <div className="info-row">
                  <span className="label">Capacity:</span>
                  <span className="value">{table.capacity} guests</span>
                </div>
              </div>

              <div className="qr-actions">
                <button
                  onClick={() => handleDownloadQR(table)}
                  className="btn-download"
                  title="Download QR Code"
                >
                  ⬇️ Download
                </button>
                <button
                  onClick={() => handlePrintQR(table)}
                  className="btn-print"
                  title="Print QR Code"
                >
                  🖨️ Print
                </button>
                {canManageQR() && (
                  <button
                    onClick={() => handleRegenerateQR(table.table_id, table.table_name)}
                    disabled={regenerating === table.table_id}
                    className="btn-regenerate"
                    title="Generate New QR Code"
                  >
                    🔄 {regenerating === table.table_id ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="info-section">
        <h2>📋 How to Use</h2>
        <div className="instructions-grid">
          <div className="instruction-card">
            <div className="step-number">1</div>
            <h3>Download or Print</h3>
            <p>Get the QR code for each table/location</p>
          </div>
          <div className="instruction-card">
            <div className="step-number">2</div>
            <h3>Place QR Codes</h3>
            <p>Put QR stickers on tables or stands on bars</p>
          </div>
          <div className="instruction-card">
            <div className="step-number">3</div>
            <h3>Customers Scan</h3>
            <p>Guests scan to open their bar tab instantly</p>
          </div>
          <div className="instruction-card">
            <div className="step-number">4</div>
            <h3>Track & Manage</h3>
            <p>All tabs automatically linked to locations</p>
          </div>
        </div>

        <div className="warning-box">
          <h4>⚠️ Important:</h4>
          <ul>
            <li>QR codes are <strong>permanent</strong> - reuse them every shift</li>
            <li>Only regenerate if a QR code is compromised</li>
            <li>Print on waterproof material for durability</li>
            <li>Keep backup copies of all QR codes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// QR Code Display Component
function QRCodeDisplay({ qrUrl }) {
  const [qrImage, setQrImage] = useState(null);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const fullUrl = `${window.location.origin}${qrUrl}`;
        const dataUrl = await QRCode.toDataURL(fullUrl, {
          width: 200,
          margin: 1,
        });
        setQrImage(dataUrl);
      } catch (error) {
        console.error('Error generating QR:', error);
      }
    };
    generateQR();
  }, [qrUrl]);

  return qrImage ? (
    <img src={qrImage} alt="QR Code" className="qr-image" />
  ) : (
    <div className="qr-loading">Generating...</div>
  );
}

QRCodeDisplay.propTypes = {
  qrUrl: PropTypes.string.isRequired,
};
