import { NextResponse } from "next/server";
import { generateInvite } from "@/lib/inviteService";

export async function POST(req: Request) {
    try {
        // Basic security check - in a real app, use a robust admin check
        // For now, we'll assume this is an internal tool or protected by Vercel/Middleware
        // Or we can check a secret header
        const authHeader = req.headers.get("x-admin-secret");
        if (authHeader !== process.env.ADMIN_SECRET) {
            // If no secret is set, we might want to block it, but for dev/MVP maybe allow?
            // Let's enforce it if the env var exists.
            if (process.env.ADMIN_SECRET) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const { email } = await req.json();
        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const code = await generateInvite(email);
        return NextResponse.json({ code });
    } catch (error) {
        console.error("Error generating invite:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
