/**
 * QR Code Scanner Component
 * Scans QR codes using device camera
 */

import React, { useEffect, useRef, useState } from 'react';
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
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
          setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.error('Error getting cameras:', err);
        if (onError) onError('No camera found or permission denied');
      });
  }, []);

  // Start scanning
  const startScanning = async () => {
    if (!selectedCamera) {
      if (onError) onError('No camera selected');
      return;
    }

    try {
      html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      
      // Configure scanning for mobile optimization
      const config = {
        fps: 10,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // Use 80% of the viewport width/height for better mobile scanning
          const minEdgePercentage = 0.8;
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return {
            width: qrboxSize,
            height: qrboxSize
          };
        },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true // Enable flashlight on supported devices
      };

      await html5QrCodeRef.current.start(
        selectedCamera,
        config,
        (decodedText, decodedResult) => {
          // Success callback with vibration feedback on mobile
          if (navigator.vibrate) {
            navigator.vibrate(200); // Haptic feedback
          }
          if (onScan) {
            onScan(decodedText);
          }
          stopScanning();
        },
        (errorMessage) => {
          // Error callback (frequent, so we don't log)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
      if (onError) onError('Failed to start camera');
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
        console.error('Error stopping scanner:', err);
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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '20px' 
    }}>
      {/* Camera selection */}
      {cameras.length > 1 && !isScanning && (
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <label 
            htmlFor="camera-select"
            style={{ 
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500' 
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
              borderRadius: '6px'
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
          border: isScanning ? '3px solid #667eea' : 'none',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: isScanning ? '0 8px 16px rgba(102, 126, 234, 0.2)' : 'none'
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
              background: selectedCamera ? '#667eea' : '#ccc',
              border: 'none',
              borderRadius: '12px',
              cursor: selectedCamera ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              minHeight: '56px',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
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
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            ⏹️ Stop Scanning
          </button>
        )}
      </div>

      {/* Instructions - Mobile friendly */}
      {isScanning && (
        <div style={{
          textAlign: 'center',
          padding: '16px',
          background: '#f7fafc',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '100%'
        }}>
          <p style={{ 
            color: '#667eea',
            fontSize: '16px',
            margin: '0 0 8px 0',
            fontWeight: '600'
          }}>
            📱 Point your camera at the QR code
          </p>
          <p style={{
            color: '#666',
            fontSize: '14px',
            margin: 0
          }}>
            Keep the QR code within the frame. Your device will vibrate when scanned.
          </p>
        </div>
      )}
      
      {/* Camera permissions hint */}
      {!isScanning && cameras.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          background: '#fff3cd',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '100%',
          border: '2px solid #ffc107'
        }}>
          <p style={{ 
            color: '#856404',
            fontSize: '16px',
            margin: '0 0 8px 0',
            fontWeight: '600'
          }}>
            📷 Camera Access Required
          </p>
          <p style={{
            color: '#856404',
            fontSize: '14px',
            margin: 0
          }}>
            Please allow camera access in your browser settings to use the QR scanner.
          </p>
        </div>
      )}
    </div>
  );
};

export default QRCodeScanner;
