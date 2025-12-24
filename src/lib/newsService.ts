import { db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { OrbitInsightCard } from "@/types/orbit";
import { generateId } from "@/lib/id";

// Collection for storing cached daily news by topic
const dailyNewsDoc = (topic: string, date: string) =>
    doc(db, "system", "daily-news", topic, date);

type AiNewsResponse = {
    title: string;
    summary: string;
    paragraphs: string[];
    imageKeywords: string;
    referenceUrl?: string | null;
};

export const generateDailyNews = async (
    topic: string,
    _userId: string // passed for potential personalization later, currently unused
): Promise<OrbitInsightCard | null> => {
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

    // 2. Generate with OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("[NewsService] API Key configured?", !!apiKey, apiKey ? `(Length: ${apiKey.length})` : "(Missing)");

    if (!apiKey) {
        console.warn("[NewsService] OPENAI_API_KEY not configured. Returning fallback news.");
        return getFallbackNews(topic, "Missing OPENAI_API_KEY env var");
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `You are an expert tech news curator. Generate a daily news summary for the topic: "${topic}".
Current Date: ${today}
Strictly focus on news and events from the last 24 hours.
Return a JSON object with:
- title: string (catchy headline, specific to the news event)
- summary: string (2-sentence overview for a dashboard card)
- paragraphs: string[] (3-4 short paragraphs, 3 sentences max each, telling the full story)
- imageKeywords: string (3-4 comma-separated keywords to find a relevant image on Unsplash)
- referenceUrl: string | null (URL to a credible news source covering this story, or null if synthesising general trends)
Tone: professional, forward-looking, engaging. Avoid jargon where possible.`,
                    },
                    {
                        role: "user",
                        content: `Generate the latest news for ${topic} from today, ${today}. Focus on specific announcements or events.`,
                    },
                ],
                temperature: 0.5,
                max_tokens: 600,
            }),
        });

        if (!response.ok) {
            console.error("[NewsService] OpenAI error:", response.status, await response.text());
            return getFallbackNews(topic, `OpenAI API Error: ${response.status}`);
        }

        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content;
        if (!content) return getFallbackNews(topic, "OpenAI returned empty content");

        const parsed = JSON.parse(content) as AiNewsResponse;

        // 3. Construct Card
        // Note: Real unsplash search requires an API, for now we can either use a placeholder or keywords with a specific source if available.
        // Better mock: simple unsplash source url with keywords
        // const dynamicImage = `https://source.unsplash.com/1600x900/?${encodeURIComponent(parsed.imageKeywords)}`;
        // Actually source.unsplash is deprecated/unreliable for some. Let's use the keywords in a search URL structure or similar if possible, 
        // but for now let's stick to a generic tech image or leave it blank to let the UI handle fallback, 
        // OR effectively use the provided mock image from before but maybe randomized.
        // Let's try the keyword approach but fallback safely.

        // Using a reliable random tech image since source.unsplash is deprecated
        const randomTechImage = "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop";

        const card: OrbitInsightCard = {
            id: generateId(),
            topic: topic,
            type: "news",
            title: parsed.title,
            summary: parsed.summary,
            paragraphs: parsed.paragraphs,
            mediaType: "image",
            imageUrl: randomTechImage, // keeping it safe
            referenceUrl: parsed.referenceUrl || `https://www.google.com/search?q=${encodeURIComponent(parsed.title)}`,
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
        console.error("Error generating news:", error);
        return getFallbackNews(topic, `Exception: ${(error as Error).message}`);
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
