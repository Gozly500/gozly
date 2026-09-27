-- ============================================================
-- Ajout : couleur d'accent du tableau de bord (Paramètres du compte >
-- Apparence, quand l'interrupteur "Couleur" est éteint : Sombre/Clair +
-- accent Gozly / Vert / Rose / Coucher de soleil). L'accent colore le bouton
-- principal, la barre latérale et la barre du bas de l'app mobile.
--
-- NULL = accent Gozly par défaut (indigo). Voir lib/themes.js (ACCENTS).
-- L'app employé (/moi) garde son accent sur l'appareil (localStorage), pas ici.
--
-- Les GRANT/policy UPDATE sur profils existent déjà (parametres_compte.sql),
-- donc aucune permission supplémentaire n'est nécessaire.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table profils add column if not exists theme_accent text;
