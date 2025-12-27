export type AppName = 'dashboard' | 'split' | 'budget' | 'journal' | 'orbit' | 'flow' | 'quest' | 'general';

export interface Feedback {
    id: string;
    app: AppName;
    email?: string;
    message: string;
    upvotes: string[]; // Array of user IDs who upvoted
    createdAt: string; // ISO string
}
