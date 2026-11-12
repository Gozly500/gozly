-- Lien vers le tableau de bord de l'app sur le site du développeur (bouton « Ouvrir », nouvel onglet).
alter table apps_developpeur add column if not exists url_externe text;
