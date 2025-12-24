import { generateId } from "@/lib/id";
import * as cheerio from "cheerio";

type GoogleSearchResult = {
    title: string;
    link: string;
    snippet: string;
    pagemap?: {
        cse_image?: { src: string }[];
        metatags?: { [key: string]: string }[];
    };
};

type NewsAgentResponse = {
    title: string;
    summary: string;
    paragraphs: string[];
    imageKeywords: string;
    referenceUrl: string | null;
    images?: string[];
};

// Validates that we have the necessary API keys
const checkConfiguration = () => {
    const googleKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_CX;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!googleKey) throw new Error("Missing GOOGLE_SEARCH_API_KEY");
    if (!googleCx) throw new Error("Missing GOOGLE_SEARCH_CX");
    if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

    return { googleKey, googleCx, openaiKey };
};

export class NewsAgent {
    static async generate(topic: string): Promise<NewsAgentResponse> {
        const { googleKey, googleCx, openaiKey } = checkConfiguration();
        const today = new Date().toISOString().slice(0, 10);

        // 1. Search with Google Custom Search API
        console.log(`[NewsAgent] Searching Google for: "${topic}" (Date: ${today})`);

        const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
        searchUrl.searchParams.append("key", googleKey);
        searchUrl.searchParams.append("cx", googleCx);
        searchUrl.searchParams.append("q", `${topic} news`);
        searchUrl.searchParams.append("dateRestrict", "d1"); // Last 24 hours
        searchUrl.searchParams.append("num", "5");

        const searchResponse = await fetch(searchUrl.toString());

        if (!searchResponse.ok) {
            const errText = await searchResponse.text();
            throw new Error(`Google Search API Error: ${searchResponse.status} ${errText}`);
        }

        const searchData = await searchResponse.json();
        const results = (searchData.items || []) as GoogleSearchResult[];

        if (results.length === 0) {
            throw new Error("No recent news found by Google.");
        }

        // 2. Scrape and Prepare Context
        console.log(`[NewsAgent] Found ${results.length} articles. Scraping...`);

        let context = "";
        const scrapedImages: string[] = [];

        // Process in parallel
        await Promise.all(results.map(async (r, i) => {
            try {
                // Fetch page HTML
                // Note: Standard fetch might fail on some sites due to bot protection. 
                // In a real prod env, we'd use a proxy or Headless browser. 
                // For now, we try standard fetch with a user-agent.
                const pageRes = await fetch(r.link, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
                    },
                    signal: AbortSignal.timeout(5000) // 5s timeout
                });

                if (!pageRes.ok) return;

                const html = await pageRes.text();
                const $ = cheerio.load(html);

                // Extract Hero Image
                const ogImage = $('meta[property="og:image"]').attr('content');
                if (ogImage) scrapedImages.push(ogImage);

                // Extract Text
                // Check common article tags
                let text = "";
                $('article, main, .content, .post-content').each((_, el) => {
                    text += $(el).text() + "\n";
                });

                // Fallback to paragraphs if no main container found
                if (text.length < 500) {
                    text = "";
                    $('p').each((_, el) => {
                        const pText = $(el).text();
                        if (pText.length > 50) text += pText + "\n";
                    });
                }

                // Clean text
                text = text.replace(/\s+/g, " ").trim().slice(0, 2000);

                if (text.length > 100) {
                    context += `\n\n--- ARTICLE ${i + 1} ---\nTitle: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}\nContent:\n${text}`;
                }

            } catch (err) {
                console.warn(`[NewsAgent] Failed to scrape ${r.link}:`, err);
                // Fallback to snippet if scraping fails
                context += `\n\n--- ARTICLE ${i + 1} ---\nTitle: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}\n(Content scraping failed)`;
            }
        }));

        // Collect google images from pagemap as fallback
        results.forEach(r => {
            if (r.pagemap?.cse_image?.[0]?.src) {
                scrapedImages.push(r.pagemap.cse_image[0].src);
            }
        });

        // 3. Synthesize with OpenAI
        const prompt = `You are an expert news reporter. 
Current Date: ${today}
Topic: ${topic}

Refine the following REAL NEWS CONTENT into a professional Daily News Brief.
Strictly adhere to the facts in the provided text. Do not hallucinate.

Search Results:
${context}

Instructions:
1. Identify the most significant story or common theme across these articles.
2. Select the BEST single reference URL from the provided articles (choose the most credible/comprehensive one).
3. Generate a JSON response with:
   - title: Catchy headline for the main story.
   - summary: 2-sentence executive summary.
   - paragraphs: 3-4 short paragraphs detailing the story.
   - imageKeywords: 3-4 keywords for finding an image.
   - referenceUrl: The URL of the best article you selected.

Output Format: JSON only.`;

        const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: "You are a helpful grounded news assistant." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3,
            }),
        });

        if (!openAiResponse.ok) {
            throw new Error(`OpenAI API Error: ${openAiResponse.status}`);
        }

        const completion = await openAiResponse.json();
        const content = completion.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty OpenAI response");

        try {
            const parsed = JSON.parse(content) as NewsAgentResponse;
            parsed.images = scrapedImages; // Attach found images
            return parsed;
        } catch (e) {
            console.error("Failed to parse OpenAI JSON", content);
            throw new Error("Invalid JSON from OpenAI");
        }
    }
}
