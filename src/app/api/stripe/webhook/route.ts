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

    switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutSession(session);
            break;
        }
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
}

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    console.log(`Processing checkout session for user ${userId}`);
    if (userId) {
        try {
            const adminDb = getAdminDb();
            const customerId = session.customer as string;
            await adminDb.collection("users").doc(userId).set(
                {
                    tier: "plus",
                    stripeCustomerId: customerId,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );
            console.log(`Successfully upgraded user ${userId} to Plus.`);
        } catch (error) {
            console.error("Error updating user tier:", error);
            throw error; // Re-throw to be caught by the caller if needed, or handle gracefully
        }
    }
}
