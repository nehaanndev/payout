import { db } from "./firebase";
import { collection, addDoc, getDocs, updateDoc, doc, arrayUnion, arrayRemove, query, orderBy, serverTimestamp } from "firebase/firestore";
import { Feedback, AppName } from "@/types/feedback";

const COLLECTION_NAME = "feedback";

export const addFeedback = async (
    app: AppName,
    message: string,
    email?: string
) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            app,
            message,
            email: email || null,
            upvotes: [],
            createdAt: new Date().toISOString(),
            createdOn: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding feedback:", error);
        throw error;
    }
};

export const getFeedbacks = async (): Promise<Feedback[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Feedback[];
    } catch (error) {
        console.error("Error getting feedbacks:", error);
        return [];
    }
};

export const toggleUpvoteFeedback = async (feedbackId: string, userId: string, isUpvoted: boolean) => {
    try {
        const feedbackRef = doc(db, COLLECTION_NAME, feedbackId);
        await updateDoc(feedbackRef, {
            upvotes: isUpvoted ? arrayRemove(userId) : arrayUnion(userId),
        });
    } catch (error) {
        console.error("Error toggling upvote:", error);
        throw error;
    }
};
