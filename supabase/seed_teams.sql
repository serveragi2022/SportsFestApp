-- Optional: starting list of team names with their departments (safe to run once).
insert into public.sf_master_teams (name, department, color)
select v.name, v.department, v.color
from (values
  ('Magnificent1','EEG/CC','#2563EB'), ('Pinabuo1','SALES','#DC2626'),
  ('Windmill1','ACC/FIN','#16A34A'), ('Windmill2','ACC/FIN','#16A34A'),
  ('Mayon1','WH/PPD','#EA580C'), ('Mayon2','WH/PPD','#EA580C'),
  ('President1','KZN/MMG','#7C3AED'), ('President2','KZN/MMG','#7C3AED'),
  ('Supreme1','PRD','#0891B2'), ('Supreme2','PRD','#0891B2'),
  ('Makiling1','QCA','#CA8A04'), ('Makiling2','QCA','#CA8A04'), ('Makiling3','QCA','#CA8A04'),
  ('Ambassador1','Admin','#DB2777'), ('Ambassador2','Admin','#DB2777'),
  ('Ambassador3','Admin','#DB2777'), ('Ambassador4','Admin','#DB2777')
) as v(name, department, color)
where not exists (select 1 from public.sf_master_teams m where lower(m.name) = lower(v.name));
