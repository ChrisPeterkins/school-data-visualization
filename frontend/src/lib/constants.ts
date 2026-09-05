/** Shared vocabulary for exams, subjects, and student groups. */
export type Exam = 'pssa' | 'keystone';
export type Entity = 'school' | 'district';

export const SUBJECTS: Record<Exam, string[]> = {
  pssa: ['Mathematics', 'English Language Arts', 'Science'],
  keystone: ['Algebra I', 'Biology', 'Literature'],
};

export const SUBJECT_SHORT: Record<string, string> = {
  'Mathematics': 'Math', 'English Language Arts': 'ELA', 'Science': 'Science',
  'Algebra I': 'Algebra I', 'Biology': 'Biology', 'Literature': 'Literature',
};

export const SUBJECT_COLORS: Record<string, string> = {
  'Mathematics': '#2d4a6f', 'English Language Arts': '#27ab83', 'Science': '#c53030',
  'Algebra I': '#2d4a6f', 'Biology': '#27ab83', 'Literature': '#c53030',
};

/** PDE demographic labels in display order. */
export const GROUPS = [
  'All Students', 'Economically Disadvantaged', 'IEP', 'ELL', 'Historically Underperforming',
  'White (not Hispanic)', 'Black or African American (not Hispanic)', 'Hispanic (any race)', 'Asian (not Hispanic)',
  'Multi-ethnic (not Hispanic)', 'American Indian/Alaskan Native (not Hispanic)', 'Native Hawaiian or other Pacific Islander (not Hispanic)',
  'Male', 'Female',
];

export const GROUP_LABEL: Record<string, string> = {
  'Economically Disadvantaged': 'Econ. disadvantaged', 'IEP': 'Students with IEPs', 'ELL': 'English learners',
  'White (not Hispanic)': 'White', 'Black or African American (not Hispanic)': 'Black', 'Hispanic (any race)': 'Hispanic',
  'Asian (not Hispanic)': 'Asian', 'Multi-ethnic (not Hispanic)': 'Multi-ethnic',
  'American Indian/Alaskan Native (not Hispanic)': 'American Indian / Alaska Native',
  'Native Hawaiian or other Pacific Islander (not Hispanic)': 'Native Hawaiian / Pacific Islander',
  'Historically Underperforming': 'Historically underperforming',
};

export const groupLabel = (g: string) => GROUP_LABEL[g] ?? g;
export const subjectShort = (s: string) => SUBJECT_SHORT[s] ?? s;
export const isExam = (r: string): r is Exam => r === 'pssa' || r === 'keystone';
