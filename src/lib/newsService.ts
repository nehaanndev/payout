import { db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { OrbitInsightCard } from "@/types/orbit";
import { generateId } from "@/lib/id";
import { NewsAgent } from "@/lib/newsAgent";

// Collection for storing cached daily news by topic
const dailyNewsDoc = (topic: string, date: string) =>
    doc(db, "system", "daily-news", topic, date);



import { getNewsPreferences, saveNewsPreferences, getUserInterests } from "./orbitSummaryService";

// ... existing imports ...

export const getDailyNewsTopics = async (userId: string, interests: string[]): Promise<string[]> => {
    if (!interests || interests.length === 0) return ["Future Technology"];
    if (interests.length <= 3) return interests;

    const prefs = await getNewsPreferences(userId);
    const lastShown = prefs?.lastShownTopics || [];

    // Filter out topics shown recently
    const candles = interests.filter(t => !lastShown.includes(t));

    // If we have enough fresh candidates, pick 3 random ones
    if (candles.length >= 3) {
        return candles.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    // If not enough fresh ones, take all fresh ones + random others to fill 3
    const needed = 3 - candles.length;
    const recycled = interests.filter(t => !candles.includes(t)).sort(() => 0.5 - Math.random()).slice(0, needed);

    return [...candles, ...recycled];
};

export const generateNewsFeed = async (userId: string): Promise<OrbitInsightCard[]> => {
    const interestsData = await getUserInterests(userId);
    const interests = interestsData?.interests || ["Future Technology"];
    const topics = await getDailyNewsTopics(userId, interests);

    console.log(`[NewsService] Selected topics for ${userId}:`, topics);

    // Generate in parallel
    const cards = await Promise.all(topics.map(topic => generateDailyNews(topic, userId)));

    // Save preferences
    await saveNewsPreferences(userId, {
        lastShownTopics: topics,
        lastShownDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString()
    });

    return cards.filter(c => c !== null) as OrbitInsightCard[];
};

export const generateDailyNews = async (
    topic: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string
): Promise<OrbitInsightCard | null> => {
    // ... existing implementation ...
    const today = new Date().toISOString().slice(0, 10);
    const normalizedTopic = topic.trim().toLowerCase();
    const docRef = dailyNewsDoc(normalizedTopic, today);

    // 1. Check Cache
    try {
        console.log(`[NewsService] Checking cache for topic: ${topic}`);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const data = snapshot.data();
            const cachedCard = data?.card as OrbitInsightCard;

            // If the cached card is a fallback card, ignore it and try to generate real content
            if (cachedCard && (cachedCard.title.startsWith(`Latest in ${topic}`) || cachedCard.summary.includes("DEBUG:"))) {
                console.log(`[NewsService] Cached fallback found for ${topic}. Attempting to generate fresh content.`);
            } else {
                console.log(`[NewsService] Cache hit for ${topic}`);
                return cachedCard;
            }
        }
    } catch (error) {
        console.warn("[NewsService] Cache check failed (likely permission denied). Proceeding to generation.", error);
    }

    // 2. Generate with NewsAgent (Grounded Search)
    try {
        const parsed = await NewsAgent.generate(topic);

        // 3. Construct Card
        // Try to use a real image from the search, fallback to random tech image
        const heroImage = (parsed.images && parsed.images.length > 0)
            ? parsed.images[0]
            : "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop";

        const card: OrbitInsightCard = {
            id: generateId(),
            topic: topic,
            type: "news",
            title: parsed.title,
            summary: parsed.summary,
            paragraphs: parsed.paragraphs,
            mediaType: "image",
            imageUrl: heroImage,
            referenceUrl: parsed.referenceUrl,
        };

        // 4. Cache Result
        try {
            await setDoc(docRef, {
                card,
                createdAt: serverTimestamp(),
                keywords: parsed.imageKeywords
            });
        } catch (cacheErr) {
            console.warn("[NewsService] Cache write failed (likely permission denied). Continuing.", cacheErr);
        }

        return card;

    } catch (error: unknown) {
        console.error("Error generating news with Agent:", error);
        // Fallback to "We couldn't find fresh news" instead of hallucinating
        return getFallbackNews(topic, `Agent Error: ${(error as Error).message}`);
    }
};

const getFallbackNews = (topic: string, reason?: string): OrbitInsightCard => {
    return {
        id: generateId(),
        topic: topic,
        type: "news",
        title: `Latest in ${topic}`,
        summary: `DEBUG: ${reason || "Unknown error"}. Stay updated with the newest trends.`,
        paragraphs: [
            `We couldn't generate a fresh story for ${topic} right now.`,
            `Reason: ${reason}`,
            `Check back later for AI-curated updates on this topic.`,
        ],
        mediaType: "image",
        imageUrl: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=1000&auto=format&fit=crop",
    };
};
