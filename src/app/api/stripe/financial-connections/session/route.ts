import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2025-11-17.clover" as any,
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



        // Wait, if I don't pass a customer ID, I can't really use `account_holder`.
        // Let's see if I can create a customer first.
        // Actually, let's just create a customer for this user if we don't have one.
        // Since I don't have easy access to the DB here to check for an existing customer ID,
        // I'll create a new customer for every connection attempt for now (MVP), 
        // OR better, I should probably store the Stripe Customer ID in the user profile.
        // Given the constraints and the previous code, I'll create a new customer.

        const customer = await stripe.customers.create({
            metadata: {
                userId,
            },
        });

        const fcSession = await stripe.financialConnections.sessions.create({
            account_holder: {
                type: "customer",
                customer: customer.id,
            },
            permissions: ["transactions", "ownership"],
        });

        return NextResponse.json({ client_secret: fcSession.client_secret });
    } catch (err: unknown) {
        console.error("Stripe Financial Connections Session Error:", err);
        const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
