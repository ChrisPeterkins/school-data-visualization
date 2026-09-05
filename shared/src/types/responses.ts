/** Response shapes shared by the backend routes and the frontend client. */

export type ExamKind = 'pssa' | 'keystone';

/** One assessment result row as returned on school and district pages. */
export interface ResultRow {
  year: number;
  /** PSSA grade 3-8, or 0 for the all-grades total; Keystone rows omit it or carry 11. */
  grade?: number | null;
  subject: string;
  demographicGroup?: string;
  numberScored: number | null;
  percentAdvanced?: number | null;
  percentProficient?: number | null;
  percentBasic?: number | null;
  percentBelowBasic?: number | null;
  percentProficientOrAbove: number | null;
  /** PVAAS growth index for the row (All Students only). */
  growthScore?: number | null;
}

export interface SchoolDetail {
  id: number;
  schoolNumber: string;
  name: string;
  type: string | null;
  districtId: number;
  districtName: string;
  districtAun: string;
  countyId: number;
  countyName: string;
  countyCode: string;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  enrollment: number | null;
  gradeRange: string | null;
  isCharter: boolean | number | null;
  pssaResults: ResultRow[];
  keystoneResults: ResultRow[];
}

export interface DistrictSchoolSummary {
  id: number;
  schoolNumber: string;
  name: string;
  schoolType: string | null;
  city: string | null;
}

export interface DistrictDetail {
  id: number;
  aun: string;
  name: string;
  districtType: string | null;
  countyId: number;
  countyName: string;
  countyCode: string;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
  totalEnrollment: number | null;
  schools: DistrictSchoolSummary[];
  pssaResults: ResultRow[];
  keystoneResults: ResultRow[];
}

export interface AvailableYearsResponse {
  years: number[];
  latest: number | null;
  earliest: number | null;
  lastImportAt: string | null;
  pssaYears: number[];
  keystoneYears: number[];
  counts: { schools: number; districts: number; pssaRecords: number; keystoneRecords: number };
}
