import { Platform, Share } from 'react-native';

// Saves the backup text. Web: downloads a .json file. Phone: opens the share sheet (save to Files, send by Messenger / email, ...).
export async function saveBackupFile(json, fileName, mime = 'application/json') {
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
  }
  await Share.share({ title: fileName, message: json });
  return 'shared';
}

// Web only: opens the file chooser and resolves with the text of the chosen file (null when nothing was chosen).
export function pickBackupFile() {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Cannot read the file.'));
      reader.readAsText(file);
    };
    input.click();
  });
}
