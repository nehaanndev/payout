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
        case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdated(subscription);
            break;
        }
        case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(subscription);
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
            const subscriptionId = session.subscription as string;

            // Fetch subscription to get current period end
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            await adminDb.collection("users").doc(userId).set(
                {
                    tier: "plus",
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: subscriptionId,
                    stripeSubscriptionStatus: subscription.status,
                    stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );
            console.log(`Successfully upgraded user ${userId} to Plus.`);
        } catch (error) {
            console.error("Error updating user tier:", error);
            throw error;
        }
    }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error("No userId found in subscription metadata");
        return;
    }

    try {
        const adminDb = getAdminDb();
        const status = subscription.status;
        const isPlus = status === "active" || status === "trialing";

        await adminDb.collection("users").doc(userId).set(
            {
                tier: isPlus ? "plus" : "free",
                stripeSubscriptionStatus: status,
                stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );
        console.log(`Updated subscription for user ${userId}. Status: ${status}`);
    } catch (error) {
        console.error("Error updating subscription:", error);
        throw error;
    }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error("No userId found in subscription metadata");
        return;
    }

    try {
        const adminDb = getAdminDb();
        await adminDb.collection("users").doc(userId).set(
            {
                tier: "free",
                stripeSubscriptionStatus: subscription.status,
                stripeCancelAtPeriodEnd: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );
        console.log(`Subscription deleted for user ${userId}. Downgraded to Free.`);
    } catch (error) {
        console.error("Error handling subscription deletion:", error);
        throw error;
    }
}
