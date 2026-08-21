-- Rawdha Connect: nettoyage d'un index redondant découvert lors de l'audit.
-- L'index historique community_reactions_unique_user_post_idx couvre déjà la contrainte.
-- Aucune donnée n'est supprimée.

drop index if exists public.community_reactions_post_user_uidx;
