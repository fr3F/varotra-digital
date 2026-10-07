-- Adresse qui rouvre l'application à la fin de « Se connecter avec Facebook », envoyée par
-- l'application : carnetdigital://messenger (APK) ou exp://… (Expo Go). Vide : carnetdigital://messenger.
ALTER TABLE oauth_sessions ADD COLUMN return_url TEXT;
