/**
 * SVG icon component — renders Lucide-style path data via react-native-svg.
 * No icon library dependency — paths come from tokens.ts IC map.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  d: readonly string[];
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ d, size = 20, color = '#EDE8DE', strokeWidth = 1.65 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d.map((path, i) => (
        <Path key={i} d={path} />
      ))}
    </Svg>
  );
}
