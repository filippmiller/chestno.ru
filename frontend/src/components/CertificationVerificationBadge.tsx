/**
 * Certification Verification Badge Component
 *
 * Displays verification status for producer certifications:
 * - ✓ Verified by Registry (green) - Auto-verified via official API
 * - ✓ Verified (blue) - Manually verified by admin
 * - ⏳ Document Uploaded (orange) - Awaiting verification
 * - (no badge) - Pending/Rejected/Expired
 */

import React from 'react';
import { Shield, Check, Clock } from 'lucide-react';

export enum BadgeLevel {
  VERIFIED_BY_REGISTRY = 'verified_by_registry',
  MANUALLY_VERIFIED = 'manually_verified',
  DOCUMENT_ONLY = 'document_only',
  PENDING = 'pending',
}

export interface BadgeData {
  show_badge: boolean;
  badge_level: BadgeLevel;
  badge_text: string;
  badge_color: string;
  tooltip_text: string;
  verified_at?: string;
  registry_url?: string;
}

interface CertificationVerificationBadgeProps {
  certificationId: string;
  badgeData?: BadgeData;  // If provided, use this; otherwise fetch from API
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  className?: string;
}

const CertificationVerificationBadge: React.FC<CertificationVerificationBadgeProps> = ({
  certificationId,
  badgeData,
  size = 'medium',
  showIcon = true,
  className = '',
}) => {
  const [data, setData] = React.useState<BadgeData | null>(badgeData || null);
  const [loading, setLoading] = React.useState(!badgeData);

  React.useEffect(() => {
    if (!badgeData) {
      // Fetch badge data from API
      fetch(`/api/certifications/verification/${certificationId}/badge`)
        .then(res => res.json())
        .then(data => {
          setData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch badge data:', err);
          setLoading(false);
        });
    }
  }, [certificationId, badgeData]);

  if (loading) {
    return (
      <div className="inline-flex items-center space-x-1 px-2 py-1 rounded-full bg-gray-100 text-gray-400 text-xs">
        <Clock className="w-3 h-3 animate-spin" />
        <span>Загрузка...</span>
      </div>
    );
  }

  if (!data || !data.show_badge) {
    return null;
  }

  // Size variants
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-1.5 text-base',
  };

  const iconSizes = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5',
  };

  // Icon based on badge level
  const getIcon = () => {
    if (!showIcon) return null;

    switch (data.badge_level) {
      case BadgeLevel.VERIFIED_BY_REGISTRY:
        return <Shield className={iconSizes[size]} />;
      case BadgeLevel.MANUALLY_VERIFIED:
        return <Check className={iconSizes[size]} />;
      case BadgeLevel.DOCUMENT_ONLY:
        return <Clock className={iconSizes[size]} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        inline-flex items-center space-x-1 rounded-full font-medium
        ${sizeClasses[size]}
        ${className}
      `}
      style={{
        backgroundColor: `${data.badge_color}15`,
        color: data.badge_color,
        border: `1px solid ${data.badge_color}40`,
      }}
      title={data.tooltip_text}
    >
      {getIcon()}
      <span>{data.badge_text}</span>

      {data.verified_at && (
        <span className="text-xs opacity-70 ml-1">
          ({new Date(data.verified_at).toLocaleDateString('ru-RU')})
        </span>
      )}

      {data.registry_url && (
        <a
          href={data.registry_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 underline hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      )}
    </div>
  );
};

export default CertificationVerificationBadge;


/**
 * Usage Example:
 *
 * <CertificationVerificationBadge
 *   certificationId="uuid-here"
 *   size="medium"
 *   showIcon={true}
 * />
 *
 * Or with pre-fetched data:
 *
 * <CertificationVerificationBadge
 *   certificationId="uuid-here"
 *   badgeData={badgeData}
 *   size="small"
 * />
 */
