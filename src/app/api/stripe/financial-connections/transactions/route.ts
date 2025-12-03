import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2025-11-17.clover" as any,
});

export async function POST(req: Request) {
    try {
        const { accountId } = await req.json();

        if (!accountId) {
            return NextResponse.json(
                { error: "Account ID is required" },
                { status: 400 }
            );
        }

        // Fetch transactions for the given account
        const transactions = await stripe.financialConnections.transactions.list({
            account: accountId,
            limit: 100, // Fetch up to 100 transactions
        });

        return NextResponse.json({ transactions: transactions.data });
    } catch (err: unknown) {
        console.error("Stripe Financial Connections Transactions Error:", err);
        const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
