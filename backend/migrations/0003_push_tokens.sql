-- Jeton Expo Push du téléphone : notification « Nouvelle commande » même application fermée.
ALTER TABLE devices ADD COLUMN push_token TEXT;
