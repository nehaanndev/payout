const LOCAL_STORAGE_KEY = 'user_id';

export const getOrCreateUserId = (): string => {
  let userId = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(LOCAL_STORAGE_KEY, userId);
  }
  return userId;
};
