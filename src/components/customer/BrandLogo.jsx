import React from 'react';
import { getLogoPalette } from '../../utils/url.js';

export default function BrandLogo({ company, large = false }) {
  const lower = company?.toLowerCase() ?? '';
  const cls = lower.includes('华为') ? 'huawei' : lower.includes('小米') ? 'xiaomi' : lower.includes('三星') ? 'samsung' : 'generic';
  const text = lower.includes('华为') ? '✹' : lower.includes('小米') ? 'mi' : lower.includes('三星') ? 'SAMSUNG' : company?.slice(0, 1) || '新';
  const palette = getLogoPalette(company);
  const style = cls === 'generic'
    ? { '--logo-from': palette[0], '--logo-to': palette[1], '--logo-text': palette[2] }
    : undefined;
  return <div className={`brandLogo ${cls} ${large ? 'large' : ''}`} style={style}>{text}</div>;
}
