import { NextResponse } from "next/server";
import Stripe from "stripe";
import { STRIPE_PRICE_AMOUNT_CENTS } from "@/lib/constants";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
    // If the previous error said '2025-11-17.clover', I should probably use that if I can confirm it's valid,
    // but '2024-12-18.acacia' is a common recent one.
    // Let's try to use 'latest' or just suppress if it's a type mismatch with the installed lib.
    // Actually, let's try to use the one from the error message if it seems valid for the installed SDK.
    // The error said: Type '"2025-01-27.acacia"' is not assignable to type '"2025-11-17.clover"'.
    // This implies the SDK *wants* 2025-11-17.clover.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2025-11-17.clover" as any, // Using 'as any' to avoid potential type mismatches if the installed SDK types are slightly out of sync, but this is the version it asked for.
});

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 }
            );
        }

        const origin = req.headers.get("origin") || "http://localhost:3000";

        const session = await stripe.checkout.sessions.create({
            mode: "payment", // or 'subscription' if you want recurring
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Premium Upgrade",
                            description: "Unlock all features",
                        },
                        unit_amount: STRIPE_PRICE_AMOUNT_CENTS,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${origin}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/dashboard?canceled=true`,
            metadata: {
                userId,
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err: unknown) {
        console.error("Stripe Checkout Error:", err);
        const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
