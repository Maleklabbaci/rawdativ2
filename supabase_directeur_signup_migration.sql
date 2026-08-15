-- RAWDHA+ — Inscription publique d’un directeur ou d’une directrice
-- Crée automatiquement le profil applicatif et les paramètres de la crèche
-- après la création de l’utilisateur Supabase Auth.
-- Aucun mot de passe n’est stocké dans public.comptes.

create or replace function public.handle_new_director_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  director_role text := coalesce(metadata->>'role', 'directeur');
  director_email text := coalesce(new.email, '');
  director_name text := coalesce(metadata->>'nom', '');
  director_first_name text := coalesce(metadata->>'prenom', '');
  nursery_name text := nullif(trim(coalesce(metadata->>'nomCreche', '')), '');
  director_phone text := coalesce(metadata->>'telephone', '');
  nursery_address text := coalesce(metadata->>'adresse', '');
  nursery_website text := coalesce(metadata->>'siteWeb', '');
  trial_end text := to_char((now() + interval '7 days')::date, 'YYYY-MM-DD');
begin
  -- Tant qu’il n’existe pas d’espace parent, tout nouvel utilisateur public
  -- est un directeur. Le rôle peut aussi être transmis explicitement par le formulaire.
  if director_role = 'directeur' then
    insert into public.comptes (id, data)
    values (
      new.id::text,
      jsonb_build_object(
        'nom', director_name,
        'prenom', director_first_name,
        'email', director_email,
        'motDePasse', '',
        'role', 'directeur',
        'abonnementActif', true,
        'dateFinAbonnement', trial_end,
        'nomCreche', coalesce(nursery_name, ''),
        'telephone', director_phone,
        'adresse', nursery_address
      )
    )
    on conflict (id) do update
      set data = public.comptes.data || excluded.data;

    if nursery_name is not null then
      insert into public.parametres (id, data)
      values (
      'creche_' || new.id::text,
      jsonb_build_object(
        'crecheName', nursery_name,
        'principalEmail', director_email,
        'phoneNumbers', director_phone,
        'addressLine', nursery_address,
        'tuitionFeeRate', 4500,
        'siteWeb', nursery_website,
        'logoUrl', ''
      )
      )
      on conflict (id) do update
        set data = public.parametres.data || excluded.data;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_director on auth.users;

create trigger on_auth_user_created_director
after insert on auth.users
for each row
execute function public.handle_new_director_signup();

comment on function public.handle_new_director_signup() is
  'Provisionne le profil directeur et les paramètres de crèche après inscription Supabase Auth.';
