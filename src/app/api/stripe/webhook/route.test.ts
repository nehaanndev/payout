import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Mock Stripe
const { mockConstructEvent } = vi.hoisted(() => {
    return { mockConstructEvent: vi.fn() };
});

vi.mock("stripe", () => {
    return {
        default: class Stripe {
            webhooks = {
                constructEvent: mockConstructEvent,
            };
        },
    };
});

// Mock Firebase Admin
const { mockSet, mockDoc, mockCollection } = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDoc = vi.fn(() => ({ set: mockSet }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc }));
    return { mockSet, mockDoc, mockCollection };
});

const mockFirestore = { collection: mockCollection };

vi.mock("@/lib/firebaseAdmin", () => ({
    getAdminDb: vi.fn(() => mockFirestore),
}));

// Mock headers
vi.mock("next/headers", () => ({
    headers: vi.fn(() => ({
        get: (key: string) => {
            if (key === "stripe-signature") return "valid_signature";
            return null;
        },
    })),
}));

describe("Stripe Webhook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should handle checkout.session.completed event", async () => {
        const event = {
            type: "checkout.session.completed",
            data: {
                object: {
                    metadata: { userId: "user_123" },
                },
            },
        };

        mockConstructEvent.mockReturnValue(event);

        const req = new Request("http://localhost/api/stripe/webhook", {
            method: "POST",
            body: JSON.stringify(event),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ received: true });
        expect(mockCollection).toHaveBeenCalledWith("users");
        expect(mockDoc).toHaveBeenCalledWith("user_123");
        expect(mockSet).toHaveBeenCalledWith(
            {
                tier: "plus",
                updatedAt: expect.any(String),
            },
            { merge: true }
        );
    });

    it("should handle checkout.session.async_payment_succeeded event", async () => {
        const event = {
            type: "checkout.session.async_payment_succeeded",
            data: {
                object: {
                    metadata: { userId: "user_456" },
                },
            },
        };

        mockConstructEvent.mockReturnValue(event);

        const req = new Request("http://localhost/api/stripe/webhook", {
            method: "POST",
            body: JSON.stringify(event),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ received: true });
        expect(mockCollection).toHaveBeenCalledWith("users");
        expect(mockDoc).toHaveBeenCalledWith("user_456");
        expect(mockSet).toHaveBeenCalledWith(
            {
                tier: "plus",
                updatedAt: expect.any(String),
            },
            { merge: true }
        );
    });

    it("should return 400 for invalid signature", async () => {
        mockConstructEvent.mockImplementation(() => {
            throw new Error("Invalid signature");
        });

        const req = new Request("http://localhost/api/stripe/webhook", {
            method: "POST",
            body: "invalid_body",
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data).toEqual({ error: "Webhook Error: Invalid signature" });
    });

    it("should ignore unhandled events", async () => {
        const event = {
            type: "payment_intent.succeeded",
            data: { object: {} },
        };

        mockConstructEvent.mockReturnValue(event);

        const req = new Request("http://localhost/api/stripe/webhook", {
            method: "POST",
            body: JSON.stringify(event),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ received: true });
        expect(mockCollection).not.toHaveBeenCalled();
    });
});
