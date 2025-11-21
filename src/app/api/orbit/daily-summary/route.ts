import { NextRequest, NextResponse } from "next/server";
import { listSharedLinks } from "@/lib/shareService";
import { getUserInterests, getDailySummary, saveDailySummary } from "@/lib/orbitSummaryService";
import { fetchFlowPlanSnapshot } from "@/lib/flowService";
import { getFlowDateKey } from "@/lib/flowService";
import { listBudgetsForMember, fetchBudgetMonthSnapshot } from "@/lib/budgetService";
import { getMonthKey as getBudgetMonthKey } from "@/lib/budgetService";

function getTodayDateKey(): string {
  const today = new Date();
  return getFlowDateKey(today);
}

function getYesterdayDateKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getFlowDateKey(yesterday);
}

function isMorning(): boolean {
  const hour = new Date().getHours();
  return hour < 12; // Before noon
}

async function generatePersonalizedSummary(
  yesterdayFlow: any,
  yesterdayOrbit: any[],
  yesterdayBudget: any,
  interests: string[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Build context from yesterday's data
  const flowContext = yesterdayFlow
    ? {
        tasksCompleted: yesterdayFlow.tasks?.filter((t: any) => t.status === "done").length || 0,
        totalTasks: yesterdayFlow.tasks?.length || 0,
        reflections: yesterdayFlow.reflections?.length || 0,
        categories: yesterdayFlow.tasks?.reduce((acc: any, task: any) => {
          acc[task.category] = (acc[task.category] || 0) + 1;
          return acc;
        }, {}) || {},
      }
    : null;

  const orbitContext = yesterdayOrbit.length > 0
    ? {
        linksSaved: yesterdayOrbit.length,
        topics: yesterdayOrbit
          .flatMap((link) => link.tags || [])
          .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
          .slice(0, 5),
      }
    : null;

  const budgetContext = yesterdayBudget
    ? {
        spent: yesterdayBudget.totalSpent || 0,
        entries: yesterdayBudget.entryCount || 0,
      }
    : null;

  const prompt = `Create a warm, personalized morning summary based on yesterday's activity. Be encouraging and insightful.

User interests: ${interests.join(", ")}

Yesterday's Flow activity:
${flowContext
  ? `- Completed ${flowContext.tasksCompleted} of ${flowContext.totalTasks} tasks
- ${flowContext.reflections} reflection${flowContext.reflections !== 1 ? "s" : ""} logged
- Task categories: ${Object.keys(flowContext.categories).join(", ")}`
  : "No Flow activity"}

Yesterday's Orbit saves:
${orbitContext
  ? `- Saved ${orbitContext.linksSaved} link${orbitContext.linksSaved !== 1 ? "s" : ""}
- Topics: ${orbitContext.topics.join(", ") || "None"}`
  : "No links saved"}

Yesterday's Budget activity:
${budgetContext
  ? `- ${budgetContext.entries} expense${budgetContext.entries !== 1 ? "s" : ""} logged
- Total spent: $${budgetContext.spent.toFixed(2)}`
  : "No budget activity"}

Write a 2-3 paragraph personalized summary that:
1. Celebrates what they accomplished yesterday
2. Provides gentle insights or patterns you notice
3. Encourages them for today
4. Mentions their interests naturally if relevant
5. A short blurb on some exciting development in some area of their interest.

Make sure to shuffle the order of these things seamlessly so that no two responses look like they have a pattern to them. Be warm, concise, and personal. Write in second person.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a thoughtful personal assistant that creates warm, encouraging daily summaries based on user activity.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result?.choices?.[0]?.message?.content ?? "Unable to generate summary.";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const dateKey = getTodayDateKey();

    // Check if we've already generated a summary today
    const existingDaily = await getDailySummary(userId, dateKey);
    if (existingDaily) {
      // Return cached summary (we'll need to store the full summary text)
      // For now, regenerate if cached
    }

    // Only show daily summary in the morning
    if (!isMorning()) {
      return NextResponse.json({ message: "Daily summaries are only available in the morning" }, { status: 200 });
    }

    // Get user interests
    const interests = await getUserInterests(userId);
    const interestList = interests?.interests || [];

    // Get yesterday's data
    const yesterdayKey = getYesterdayDateKey();
    const [yesterdayFlow, allShares, budgets] = await Promise.all([
      fetchFlowPlanSnapshot(userId, yesterdayKey),
      listSharedLinks(userId, { limit: 100 }),
      listBudgetsForMember(userId),
    ]);

    // Get yesterday's Orbit links (saved yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayOrbit = allShares.filter((share) => {
      const shareDate = new Date(share.createdAt);
      return shareDate >= yesterdayStart && shareDate <= yesterdayEnd;
    });

    // Get yesterday's budget expenses
    let yesterdayBudget = null;
    if (budgets.length > 0) {
      const primary = budgets[0];
      const monthKey = getBudgetMonthKey();
      const month = await fetchBudgetMonthSnapshot(primary.id, monthKey);
      
      if (month?.entries) {
        const yesterdayExpenses = month.entries.filter((entry: any) => {
          const entryDate = new Date(entry.date);
          return entryDate >= yesterdayStart && entryDate <= yesterdayEnd;
        });
        
        if (yesterdayExpenses.length > 0) {
          const totalSpent = yesterdayExpenses.reduce((sum: number, entry: any) => sum + (Number(entry.amount) || 0), 0);
          yesterdayBudget = {
            totalSpent,
            entryCount: yesterdayExpenses.length,
          };
        }
      }
    }

    // Generate personalized summary
    const summary = await generatePersonalizedSummary(
      yesterdayFlow,
      yesterdayOrbit,
      yesterdayBudget,
      interestList
    );

    // Find a relevant link from last 3-4 days based on interests
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const recentLinks = allShares.filter((share) => {
      const shareDate = new Date(share.createdAt);
      return shareDate >= fourDaysAgo && (share.contentType === "link" || share.contentType === "article");
    });

    let selectedLink = null;
    if (recentLinks.length > 0 && interestList.length > 0) {
      const interestKeywords = interestList.map((i) => i.toLowerCase());
      const matchingLinks = recentLinks.filter((link) => {
        const title = (link.title || "").toLowerCase();
        const description = (link.description || "").toLowerCase();
        const tags = (link.tags || []).map((t) => t.toLowerCase());

        return (
          interestKeywords.some((keyword) => title.includes(keyword) || description.includes(keyword)) ||
          tags.some((tag) => interestKeywords.some((keyword) => tag.includes(keyword) || keyword.includes(tag)))
        );
      });

      selectedLink = matchingLinks.length > 0
        ? matchingLinks[Math.floor(Math.random() * matchingLinks.length)]
        : recentLinks[0];
    } else if (recentLinks.length > 0) {
      selectedLink = recentLinks[0];
    }

    // Save daily summary (using a placeholder shareId if no link found)
    if (selectedLink) {
      await saveDailySummary(userId, dateKey, selectedLink.id);
    }

    return NextResponse.json({
      summary,
      linkTitle: selectedLink?.title || null,
      linkUrl: selectedLink?.url || null,
      linkDescription: selectedLink?.description || null,
    });
  } catch (error) {
    console.error("Error getting daily summary", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
