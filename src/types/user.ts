export type UserTier = 'free' | 'plus';

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    tier: UserTier;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeSubscriptionStatus?: string;
    stripeCancelAtPeriodEnd?: boolean;
    stripeCurrentPeriodEnd?: string;
    createdAt: string;
    updatedAt: string;
}
