import React from 'react';
import { SvgProps } from 'react-native-svg';

declare module 'lucide-react-native' {
  export interface LucideProps extends SvgProps {
    size?: number | string;
    color?: string;
    fill?: string;
    style?: any;
  }

  export type LucideIcon = React.FC<LucideProps>;

  export const Stethoscope: LucideIcon;
  export const Mail: LucideIcon;
  export const Lock: LucideIcon;
  export const Building: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Activity: LucideIcon;
  export const Heart: LucideIcon;
  export const Thermometer: LucideIcon;
  export const Weight: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const Clock: LucideIcon;
  export const History: LucideIcon;
  export const FileText: LucideIcon;
  export const Search: LucideIcon;
  export const PlusCircle: LucideIcon;
  export const Trash2: LucideIcon;
  export const Check: LucideIcon;
  export const PhoneOff: LucideIcon;
  export const Beaker: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Truck: LucideIcon;
  export const Compass: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const Phone: LucideIcon;
  export const AlertCircle: LucideIcon;
}
