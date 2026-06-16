import React from 'react';
import { Star } from 'lucide-react';

export default function GradeBadge({ grade, compact = false }) {
  return (
    <span className={`gradeBadge grade${grade} ${compact ? 'compactGradeBadge' : ''}`}>
      <Star size={13} />
      {grade}
    </span>
  );
}
