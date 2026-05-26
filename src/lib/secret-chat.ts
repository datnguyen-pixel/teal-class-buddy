// Hidden private conversation between two specific teacher accounts.
// dat.nguyen@victoriaschool.edu.vn  &  grace.nguyen@saigonsouth.victoriaschool.edu.vn
export const SECRET_PAIR_IDS = [
  'eb2b69fc-20a9-4197-aab7-a62adf24ce75', // Dat Nguyen
  'd074ae67-0fd2-4bf8-9ab6-9fa12def78c8', // Grace Nguyen
] as const;

export const SECRET_PASSPHRASE = '1505';

export const isSecretConversation = (a?: string | null, b?: string | null) =>
  !!a && !!b && a !== b &&
  (SECRET_PAIR_IDS as readonly string[]).includes(a) &&
  (SECRET_PAIR_IDS as readonly string[]).includes(b);

export const secretUnlockKey = (a: string, b: string) =>
  `secret-chat-unlocked:${[a, b].sort().join('|')}`;

export const isSecretUnlocked = (a: string, b: string) => {
  try {
    return sessionStorage.getItem(secretUnlockKey(a, b)) === '1';
  } catch {
    return false;
  }
};

export const setSecretUnlocked = (a: string, b: string) => {
  try {
    sessionStorage.setItem(secretUnlockKey(a, b), '1');
  } catch {
    // ignore
  }
};

// For the *current user*, returns the other secret partner's id (if they are
// one half of the secret pair). Used to silently filter notifications.
export const secretPartnerOf = (userId?: string | null): string | null => {
  if (!userId) return null;
  if (userId === SECRET_PAIR_IDS[0]) return SECRET_PAIR_IDS[1];
  if (userId === SECRET_PAIR_IDS[1]) return SECRET_PAIR_IDS[0];
  return null;
};
