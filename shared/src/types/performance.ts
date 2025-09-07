export interface PSSAResult {
  id: number;
  schoolId?: string;
  districtId?: string;
  year: number;
  grade: number;
  subject: string;
  level: 'school' | 'district' | 'state';
  totalTested?: number;
  advancedCount?: number;
  proficientCount?: number;
  basicCount?: number;
  belowBasicCount?: number;
  advancedPercent?: number;
  proficientPercent?: number;
  basicPercent?: number;
  belowBasicPercent?: number;
  proficientOrAbovePercent?: number;
  growthScore?: number;
  createdAt?: Date;
}

export interface KeystoneResult {
  id: number;
  schoolId?: string;
  districtId?: string;
  year: number;
  subject: 'Algebra I' | 'Biology' | 'Literature';
  level: 'school' | 'district' | 'state';
  grade?: number;
  totalTested?: number;
  advancedCount?: number;
  proficientCount?: number;
  basicCount?: number;
  belowBasicCount?: number;
  advancedPercent?: number;
  proficientPercent?: number;
  basicPercent?: number;
  belowBasicPercent?: number;
  proficientOrAbovePercent?: number;
  growthScore?: number;
  createdAt?: Date;
}

export type PerformanceLevel = 'Advanced' | 'Proficient' | 'Basic' | 'Below Basic';

export interface PerformanceTrend {
  year: number;
  subject: string;
  grade?: number;
  proficientOrAbove?: number;
}

export interface SchoolPerformanceTrends {
  schoolId: string;
  pssaTrends: PerformanceTrend[];
  keystoneTrends: PerformanceTrend[];
}