import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2025-11-17.clover" as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
    const body = await req.text();
    const sig = (await headers()).get("stripe-signature") as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown Error";
        console.error(`Webhook Error: ${errorMessage}`);
        return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId) {
            try {
                const adminDb = getAdminDb();
                await adminDb.collection("users").doc(userId).set(
                    {
                        tier: "plus",
                        updatedAt: new Date().toISOString(),
                    },
                    { merge: true }
                );
                console.log(`Successfully upgraded user ${userId} to Plus.`);
            } catch (error) {
                console.error("Error updating user tier:", error);
                return NextResponse.json({ error: "Database update failed" }, { status: 500 });
            }
        }
    }

    return NextResponse.json({ received: true });
}
