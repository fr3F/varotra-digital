/** Web : Alert.alert de React Native n'a pas d'équivalent, on utilise la boîte native du navigateur. */
export function confirmAction(title: string, message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
