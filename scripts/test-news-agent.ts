import { NewsAgent } from "../src/lib/newsAgent";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testNewsAgent() {
    console.log("Testing NewsAgent...");
    try {
        const topic = "SpaceX";
        const result = await NewsAgent.generate(topic);
        console.log("Success! Result:");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("NewsAgent Test Failed:", error);
    }
}

testNewsAgent();
