-- ============================================================
-- Ajout : unité (Celsius ou Fahrenheit) par équipement de température.
-- Certains clients ont des frigos qui affichent en Celsius et d'autres en Fahrenheit -
-- sans ça, un relevé en Fahrenheit (ex: 40°F, parfaitement correct) était
-- jugé non conforme parce que la vérification supposait toujours du
-- Celsius (seuils 0-4°C pour un frigo).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table equipements_temperature add column if not exists unite text not null default 'C';

alter table equipements_temperature drop constraint if exists equipements_temperature_unite_check;
alter table equipements_temperature add constraint equipements_temperature_unite_check check (unite in ('C', 'F'));
