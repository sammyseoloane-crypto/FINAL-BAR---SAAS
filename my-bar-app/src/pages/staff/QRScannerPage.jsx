/**
 * QR Scanner Page - Staff View
 * Scan customer QR codes at entrance for validation
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { scanQRCode } from '../../utils/paymentUtils';
import QRCodeScanner from '../../components/QRCodeScanner';
import PageHeader from '../../components/PageHeader';

const QRScannerPage = () => {
  const { userProfile } = useAuth();
  const [scanResult, setScanResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [showScanner, setShowScanner] = useState(true);

  const handleScan = async (qrCodeString) => {
    try {
      console.log('[Staff Scanner] 📝 Validating QR Code:', qrCodeString);
      const result = await scanQRCode(qrCodeString, userProfile.id);
      console.log('[Staff Scanner] 📋 Validation Result:', result);

      const scanEntry = {
        timestamp: new Date(),
        qrCode: qrCodeString,
        result: result,
        success: result.success || false,
      };

      setScanResult(scanEntry);
      setScanHistory((prev) => [scanEntry, ...prev].slice(0, 10)); // Keep last 10 scans

      // Hide scanner after scan
      setShowScanner(false);

      // Don't auto-clear result anymore - let user manually scan again
      // Removed: setTimeout(() => setScanResult(null), 5000);
    } catch (error) {
      console.error('Error scanning QR code:', error);
      const errorEntry = {
        timestamp: new Date(),
        qrCode: qrCodeString,
        result: { error, message: 'Scan failed' },
        success: false,
      };
      setScanResult(errorEntry);
      setScanHistory((prev) => [errorEntry, ...prev].slice(0, 10));

      // Hide scanner after error too
      setShowScanner(false);
    }
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setShowScanner(true);
  };

  const handleScanError = (errorMessage) => {
    console.error('Scanner error:', errorMessage);
  };

  const getProductTypeLabel = (type) => {
    if (!type) {
      return 'Unknown';
    }
    const typeMap = {
      drink: '🍹 Drink',
      food: '🍔 Food',
      entrance_fee: '🎫 Entrance Fee',
    };
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getResultStyle = (scanEntry) => {
    if (scanEntry.success) {
      return {
        background: '#d4edda',
        color: '#155724',
        border: '2px solid #c3e6cb',
      };
    } else if (scanEntry.result?.expired) {
      return {
        background: '#f8d7da',
        color: '#721c24',
        border: '2px solid #f5c6cb',
      };
    } else if (scanEntry.result?.alreadyScanned) {
      return {
        background: '#f8d7da',
        color: '#721c24',
        border: '3px solid #dc3545',
      };
    } else if (scanEntry.result?.notConfirmed) {
      return {
        background: '#fff3cd',
        color: '#856404',
        border: '2px solid #ffeaa7',
      };
    } else {
      return {
        background: '#f8d7da',
        color: '#721c24',
        border: '2px solid #f5c6cb',
      };
    }
  };

  const getResultIcon = (scanEntry) => {
    if (scanEntry.success) {
      return '✅';
    }
    if (scanEntry.result?.expired) {
      return '⏰';
    }
    if (scanEntry.result?.alreadyScanned) {
      return '❌';
    }
    if (scanEntry.result?.notConfirmed) {
      return '⏳';
    }
    return '❌';
  };

  return (
    <div>
      <PageHeader />
      <div
        style={{
          padding: '16px',
          maxWidth: '1000px',
          margin: '0 auto',
          paddingBottom: '80px', // Extra padding for mobile navigation
        }}
      >
        <h1
          style={{
            marginBottom: '8px',
            fontSize: 'clamp(24px, 5vw, 32px)', // Responsive font size
          }}
        >
          QR Code Scanner
        </h1>
        <p
          style={{
            color: '#666',
            marginBottom: '24px',
            fontSize: 'clamp(14px, 3vw, 16px)',
          }}
        >
          Scan customer QR codes to validate entry
        </p>

        {/* Current scan result - Mobile optimized */}
        {scanResult && (
          <div
            style={{
              ...getResultStyle(scanResult),
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px',
              animation: 'fadeIn 0.3s ease-in',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '15px',
                marginBottom: '15px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(40px, 10vw, 56px)',
                  lineHeight: 1,
                }}
              >
                {getResultIcon(scanResult)}
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h2
                  style={{
                    margin: 0,
                    marginBottom: '5px',
                    fontSize: 'clamp(18px, 4vw, 24px)',
                    wordBreak: 'break-word',
                  }}
                >
                  {scanResult.result?.message || 'Unknown result'}
                </h2>

                {/* Extra prominent message for already scanned QR codes */}
                {scanResult.result?.alreadyScanned && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '15px',
                      background: '#f8d7da',
                      border: '3px solid #dc3545',
                      borderRadius: '8px',
                      fontSize: 'clamp(18px, 4.5vw, 22px)',
                      fontWeight: '800',
                      color: '#721c24',
                      textAlign: 'center',
                    }}
                  >
                    ❌ INVALID CODE - ALREADY SCANNED ❌
                    {scanResult.result.data?.scanned_at && (
                      <div
                        style={{
                          fontSize: 'clamp(14px, 3.5vw, 16px)',
                          fontWeight: '600',
                          marginTop: '10px',
                          padding: '8px',
                          background: 'rgba(255,255,255,0.5)',
                          borderRadius: '4px',
                        }}
                      >
                        Previously scanned:{' '}
                        {new Date(scanResult.result.data.scanned_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Show error details for debugging */}
                {(scanResult.result?.error || scanResult.result?.notFound) &&
                  !scanResult.result?.data && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '15px',
                      background: 'rgba(220, 53, 69, 0.1)',
                      border: '2px solid #dc3545',
                      borderRadius: '8px',
                      fontSize: 'clamp(13px, 3.2vw, 15px)',
                      color: '#721c24',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        ⚠️ QR Code Not Found in System
                    </div>
                    <div style={{ marginBottom: '6px' }}>Possible reasons:</div>
                    <ul style={{ margin: '6px 0', paddingLeft: '20px', lineHeight: '1.6' }}>
                      <li>Transaction hasn't been confirmed by staff yet</li>
                      <li>QR code is from a different system</li>
                      <li>QR code was deleted or is invalid</li>
                    </ul>
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px',
                        background: 'rgba(0,0,0,0.05)',
                        borderRadius: '4px',
                        fontSize: 'clamp(11px, 2.8vw, 12px)',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}
                    >
                      <strong>Scanned:</strong>
                      <br />
                      {scanResult.qrCode?.substring(0, 80)}
                      {scanResult.qrCode?.length > 80 ? '...' : ''}
                    </div>
                  </div>
                )}

                <p
                  style={{
                    margin: '8px 0 0 0',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    opacity: 0.8,
                  }}
                >
                  {formatTime(scanResult.timestamp)}
                </p>
              </div>
            </div>

            {/* Customer details */}
            {scanResult.result?.data && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.5)',
                  padding: '15px',
                  borderRadius: '8px',
                  marginTop: '15px',
                }}
              >
                {scanResult.result.data.user_profile && (
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Customer:</strong>{' '}
                    {scanResult.result.data.user_profile.email || 'Unknown'}
                  </div>
                )}
                {scanResult.result.data.transactions && (
                  <>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Product:</strong>{' '}
                      {scanResult.result.data.transactions.products?.name ||
                        scanResult.result.data.transactions.metadata?.product_name ||
                        'Unknown'}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Amount:</strong> R
                      {parseFloat(scanResult.result.data.transactions.amount).toFixed(2)}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Type:</strong>{' '}
                      {getProductTypeLabel(
                        scanResult.result.data.transactions.products?.type ||
                          scanResult.result.data.transactions.metadata?.product_type,
                      )}
                    </div>
                    {scanResult.result.data.transactions.metadata?.quantity && (
                      <div>
                        <strong>Quantity:</strong>{' '}
                        {scanResult.result.data.transactions.metadata.quantity}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scanner - Mobile optimized - Only show when showScanner is true */}
        {showScanner ? (
          <div
            style={{
              background: '#fff',
              padding: 'clamp(16px, 4vw, 30px)',
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <QRCodeScanner onScan={handleScan} onError={handleScanError} />
          </div>
        ) : (
          /* Scan Again Button - Show when scanner is hidden */
          <div
            style={{
              background: '#fff',
              padding: 'clamp(16px, 4vw, 30px)',
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}
          >
            <button
              onClick={handleScanAgain}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '18px 32px',
                fontSize: '20px',
                fontWeight: '700',
                color: '#fff',
                background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                minHeight: '64px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              📸 Scan Another QR Code
            </button>
          </div>
        )}

        {/* Scan history - Mobile responsive */}
        {scanHistory.length > 0 && (
          <div>
            <h2
              style={{
                marginBottom: '15px',
                fontSize: 'clamp(18px, 4vw, 20px)',
              }}
            >
              Recent Scans
            </h2>
            <div
              style={{
                background: '#fff',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {scanHistory.map((entry, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderBottom: index < scanHistory.length - 1 ? '1px solid #e2e8f0' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: '1 1 auto',
                      minWidth: '200px',
                    }}
                  >
                    <div style={{ fontSize: 'clamp(20px, 5vw, 24px)' }}>{getResultIcon(entry)}</div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: '600',
                          marginBottom: '4px',
                          fontSize: 'clamp(14px, 3.5vw, 16px)',
                        }}
                      >
                        {entry.result?.message || 'Unknown result'}
                      </div>
                      {entry.result?.data?.user_profile && (
                        <div
                          style={{
                            fontSize: 'clamp(12px, 3vw, 14px)',
                            color: '#666',
                          }}
                        >
                          {entry.result.data.user_profile.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      color: '#666',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatTime(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions - Mobile friendly */}
        <div
          style={{
            marginTop: '24px',
            padding: 'clamp(16px, 4vw, 20px)',
            background: '#edf2f7',
            borderRadius: '12px',
            fontSize: 'clamp(13px, 3vw, 14px)',
            color: '#4a5568',
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: '15px',
              fontSize: 'clamp(15px, 3.5vw, 16px)',
            }}
          >
            Scanner Instructions
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>
              <strong>✅ Scanned:</strong> Valid QR code. Customer can enter.
            </li>
            <li>
              <strong>❌ Invalid Code, Already Scanned:</strong> QR code was used before. Deny
              entry.
            </li>
            <li>
              <strong>⏳ Not Confirmed:</strong> Payment not confirmed yet. Direct to payment desk.
            </li>
            <li>
              <strong>❌ Invalid:</strong> QR code not found or invalid. Customer needs assistance.
            </li>
          </ul>
        </div>

        <style>
          {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
        </style>
      </div>
    </div>
  );
};

export default QRScannerPage;
