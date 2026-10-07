import { Redirect } from 'expo-router';

/** Retour de « Se connecter avec Facebook » (carnetdigital://messenger) : on revient aux réglages. */
export default function MessengerReturnRoute() {
  return <Redirect href="/settings" />;
}
