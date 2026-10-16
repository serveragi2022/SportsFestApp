import { Alert as NativeAlert, Platform } from 'react-native';

// Alert.alert does nothing on the web (react-native-web), so confirmations never appeared and
// actions like "choose winner" silently did nothing in the browser. This keeps the same call shape.
export const Alert = {
  alert(title, message, buttons) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons);
    const text = message ? `${title}\n\n${message}` : title;
    const list = buttons || [];
    const action = list.find((b) => b.style !== 'cancel' && b.onPress);
    const hasCancel = list.some((b) => b.style === 'cancel');
    if (hasCancel && action) {
      if (window.confirm(text)) action.onPress();
    } else {
      window.alert(text);
      if (action) action.onPress();
    }
    return undefined;
  },
};
