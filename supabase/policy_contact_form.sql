-- Autorise n'importe quel visiteur du site (même non connecté) à ENVOYER
-- un message via le formulaire de contact. Il ne pourra jamais LIRE les
-- messages des autres - juste en ajouter un nouveau.

create policy "Permettre l'envoi de messages de contact"
on messages_contact
for insert
to anon
with check (true);
