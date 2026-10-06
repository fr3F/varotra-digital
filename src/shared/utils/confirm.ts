import { Alert } from 'react-native';
import { commonMessages } from '@/core/i18n/common.messages';
import { messagesOf } from '@/core/i18n/i18n';

/** Boîte de confirmation native, en promesse (boutons dans la langue de l'application). */
export function confirmAction(title: string, message: string, confirmLabel?: string): Promise<boolean> {
  const { actions } = messagesOf(commonMessages);
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: actions.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel ?? actions.confirm, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
