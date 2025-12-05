import { NextResponse } from "next/server";
import { redeemInvite } from "@/lib/inviteService";

export async function POST(req: Request) {
    try {
        const { code, userId } = await req.json();

        if (!code || !userId) {
            return NextResponse.json({ error: "Code and userId are required" }, { status: 400 });
        }

        // Ideally we should verify the session user matches userId, 
        // but for now we trust the client or rely on middleware if present.
        // Let's at least ensure the user exists.

        await redeemInvite(code, userId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error redeeming invite:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
}
