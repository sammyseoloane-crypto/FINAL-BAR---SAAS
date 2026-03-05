/**
 * QR Code Generator Component
 * Displays a QR code for a given string value
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

const QRCodeGenerator = ({ value, size = 256, level = 'M', includeMargin = true }) => {
  if (!value) {
    return (
      <div 
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #ccc',
          borderRadius: '8px',
          color: '#666'
        }}
      >
        No QR Code
      </div>
    );
  }

  return (
    <div 
      style={{
        padding: '20px',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'inline-block'
      }}
    >
      <QRCodeSVG 
        value={value}
        size={size}
        level={level}
        includeMargin={includeMargin}
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default QRCodeGenerator;
