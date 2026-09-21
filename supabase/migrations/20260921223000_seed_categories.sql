insert into public.categories(slug,name) values
  ('celulares','Celulares'),
  ('pc-games','PC & Games'),
  ('eletronicos','Eletrônicos'),
  ('casa','Casa'),
  ('ferramentas','Ferramentas'),
  ('esportes','Esportes'),
  ('instrumentos','Instrumentos'),
  ('colecionaveis','Colecionáveis')
on conflict do nothing;
