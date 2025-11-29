export type UserTier = 'free' | 'plus';

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    tier: UserTier;
    createdAt: string;
    updatedAt: string;
}
