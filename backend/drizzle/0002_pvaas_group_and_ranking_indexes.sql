-- PVAAS rows record which student group they describe; propagation to the
-- All Students result rows only uses All Students growth.
ALTER TABLE pvaas_results ADD COLUMN student_group TEXT NOT NULL DEFAULT 'All Students';
CREATE INDEX IF NOT EXISTS pvaas_group_idx ON pvaas_results(student_group);

-- Covering indexes for the rankings / growth-achievement queries, which filter
-- on level + year + group + grade and group by school.
CREATE INDEX IF NOT EXISTS pssa_rank_idx ON pssa_results(level, year, demographic_group, grade, school_id);
CREATE INDEX IF NOT EXISTS keystone_rank_idx ON keystone_results(level, year, demographic_group, school_id);
ALTER TABLE districts ADD COLUMN nces_id TEXT;
