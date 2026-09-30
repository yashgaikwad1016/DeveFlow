import React from 'react';

export default function DevFlowLogo({
  variant = 'navbar',
  className = '',
  style = {},
  priority = true,
  alt = 'DevFlow - From Ideas to Delivery, All in One Flow',
}) {
  // Variant sizing mapping
  const variantClass = `devflow-logo-${variant}`;

  return (
    <div className={`devflow-brand-container ${variantClass} ${className}`} style={style}>
      <img
        src="/devflow-logo.png"
        alt={alt}
        width="750"
        height="248"
        className="devflow-brand-logo-img"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
}
