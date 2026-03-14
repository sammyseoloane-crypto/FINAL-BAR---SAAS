/**
 * QR Code Scanner Component
 * Scans QR codes using device camera
 */

import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Html5Qrcode } from 'html5-qrcode';

const QRCodeScanner = ({ onScan, onError }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Get available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          // Prefer back camera for mobile
          const backCamera = devices.find((d) => d.label.toLowerCase().includes('back'));
          const selectedId = backCamera ? backCamera.id : devices[0].id;
          setSelectedCamera(selectedId);
        }
      })
      .catch((err) => {
        console.error('[QR Scanner] Error getting cameras:', err);
        if (onError) {
          onError('No camera found or permission denied');
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start scanning
  const startScanning = async () => {
    if (!selectedCamera) {
      if (onError) {
        onError('No camera selected');
      }
      return;
    }

    try {
      // Request camera permission explicitly first
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permErr) {
        console.error('[QR Scanner] Camera permission error:', permErr);
        if (onError) {
          if (permErr.name === 'NotAllowedError') {
            onError(
              '❌ Camera permission denied. Please allow camera access in your browser settings.',
            );
          } else if (permErr.name === 'NotFoundError') {
            onError('❌ No camera found on this device.');
          } else if (permErr.name === 'NotReadableError') {
            onError('❌ Camera is already in use by another application.');
          } else {
            onError(`❌ Camera access error: ${permErr.message}`);
          }
        }
        return;
      }

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');

      // Configure scanning for mobile optimization
      const config = {
        fps: 10, // Scan 10 frames per second
        qrbox: function (viewfinderWidth, viewfinderHeight) {
          // Use 70% of viewport for better QR code targeting on mobile
          const minEdgePercentage = 0.7;
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return {
            width: qrboxSize,
            height: qrboxSize,
          };
        },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true, // Enable flashlight on supported devices
        // Support all scan types for QR codes with format: tenantId_userId_transactionId_timestamp_random
        formatsToSupport: [0], // 0 = QR_CODE
      };

      await html5QrCodeRef.current.start(
        selectedCamera,
        config,
        (decodedText, _decodedResult) => {
          // Success callback - QR code scanned!
          // Haptic feedback on mobile
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }

          if (onScan) {
            onScan(decodedText);
          }

          stopScanning();
        },
        (_errorMessage) => {
          // Error callback - fires frequently while scanning, so we don't log
          // Only uncomment for deep debugging:
          // console.debug('[QR Scanner] Scan attempt:', _errorMessage);
        },
      );

      setIsScanning(true);
    } catch (err) {
      console.error('[QR Scanner] Error starting scanner:', err);
      if (onError) {
        onError(`❌ Failed to start camera: ${err.message}`);
      }
    }
  };

  // Stop scanning
  const stopScanning = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('[QR Scanner] Error stopping scanner:', err);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      {/* Camera selection */}
      {cameras.length > 1 && !isScanning && (
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <label
            htmlFor="camera-select"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
            }}
          >
            Select Camera:
          </label>
          <select
            id="camera-select"
            value={selectedCamera || ''}
            onChange={(e) => setSelectedCamera(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
            }}
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Scanner container - Mobile optimized */}
      <div
        id="qr-reader"
        ref={scannerRef}
        style={{
          width: '100%',
          maxWidth: '600px',
          minHeight: isScanning ? '400px' : '0',
          border: isScanning ? '3px solid #d4af37' : 'none',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: isScanning ? '0 8px 16px rgba(102, 126, 234, 0.2)' : 'none',
        }}
      />

      {/* Control buttons - Mobile friendly */}
      <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '600px' }}>
        {!isScanning ? (
          <button
            onClick={startScanning}
            disabled={!selectedCamera}
            style={{
              flex: 1,
              padding: '16px 24px',
              fontSize: '18px',
              fontWeight: '600',
              color: '#fff',
              background: selectedCamera ? '#d4af37' : '#ccc',
              border: 'none',
              borderRadius: '12px',
              cursor: selectedCamera ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              minHeight: '56px',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            📸 Start Scanning
          </button>
        ) : (
          <button
            onClick={stopScanning}
            style={{
              flex: 1,
              padding: '16px 24px',
              fontSize: '18px',
              fontWeight: '600',
              color: '#fff',
              background: '#e53e3e',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minHeight: '56px',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ⏹️ Stop Scanning
          </button>
        )}
      </div>

      {/* Instructions - Mobile friendly */}
      {isScanning && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            background: '#f7fafc',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '100%',
          }}
        >
          <p
            style={{
              color: '#d4af37',
              fontSize: '16px',
              margin: '0 0 8px 0',
              fontWeight: '600',
            }}
          >
            📱 Point your camera at the QR code
          </p>
          <p
            style={{
              color: '#666',
              fontSize: '14px',
              margin: '0 0 8px 0',
            }}
          >
            Keep the QR code centered within the frame.
          </p>
          <p
            style={{
              color: '#d4af37',
              fontSize: '13px',
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            💡 Tip: Hold steady 6-12 inches away. Device will vibrate when scanned.
          </p>
        </div>
      )}

      {/* Camera permissions hint */}
      {!isScanning && cameras.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '20px',
            background: '#fff3cd',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '100%',
            border: '2px solid #ffc107',
          }}
        >
          <p
            style={{
              color: '#856404',
              fontSize: '16px',
              margin: '0 0 8px 0',
              fontWeight: '600',
            }}
          >
            📷 Camera Access Required
          </p>
          <p
            style={{
              color: '#856404',
              fontSize: '14px',
              margin: 0,
            }}
          >
            Please allow camera access in your browser settings to use the QR scanner.
          </p>
        </div>
      )}
    </div>
  );
};

QRCodeScanner.propTypes = {
  onScan: PropTypes.func.isRequired,
  onError: PropTypes.func,
};

export default QRCodeScanner;
