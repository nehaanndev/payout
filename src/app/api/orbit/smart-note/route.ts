
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json(
                { error: "Text is required" },
                { status: 400 }
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error("OPENAI_API_KEY is missing");
            return NextResponse.json(
                { error: "Service configuration error" },
                { status: 500 }
            );
        }

        const systemPrompt = `You are a "Smart Note" assistant. Your job is to take raw, messy notes and convert them into beautiful, structured Markdown.

Follow these rules:
1.  **Structure**: Use headings (#, ##), lists (bullet or numbered), and tables where appropriate to organize the content.
2.  **Visuals**: Use relevant emojis/icons to make the note visually appealing. 
    *   Use 📅 for dates/events.
    *   Use ✅ for implied tasks/todos.
    *   Use 🛒 for shopping items.
    *   Use 💡 for ideas.
    *   Use other relevant emojis as you see fit.
3.  **TodoList Detection**: If the note looks like a list of tasks, format it as a checklist (- [ ] task).
4.  **Context Augmentation**: If you see a term followed by a question mark (e.g., "Kafka?" or "What is deep learning?"), or if the user explicitly asks for explanation ("explain X"), ADD a specific section at the bottom of the relevant block called "> 💡 **Context: [Term]**" and provide a brief (1-2 sentence) explanation of that term.
5.  **Tone**: Keep the original meaning and specific details exactly as they are. Do not delete information. Just format and enhance.

Example Input:
"meeting with john tomorrow at 2pm about the marketing launch
buy milk eggs bread
what is hubspot?
check flights to london"

Example Output:
"## 📅 Meeting: Marketing Launch
*   **Who**: John
*   **When**: Tomorrow at 2pm

## 🛒 Shopping List
*   [ ] Milk
*   [ ] Eggs
*   [ ] Bread

## ✈️ Tasks
*   [ ] Check flights to London

> 💡 **Context: HubSpot**
> HubSpot is a customer relationship management (CRM) platform that helps companies attract visitors, convert leads, and close customers."
`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text },
                ],
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("OpenAI API error:", response.status, errorData);
            return NextResponse.json(
                { error: "Failed to process note" },
                { status: response.status }
            );
        }

        const result = await response.json();
        const markdown = result.choices?.[0]?.message?.content || "";

        return NextResponse.json({ markdown });
    } catch (error) {
        console.error("Smart note API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
