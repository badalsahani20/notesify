import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../src/models/user.model.js";
import { sendAppReleaseEmail, verifyMailConnection } from "../src/services/mail.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log("=== Notesify App Release Broadcast Script ===\n");

    const args = process.argv.slice(2);
    const isTest = args.includes("--test");
    const isDryRun = args.includes("--dry-run");
    const isBroadcast = args.includes("--broadcast");
    const hasConfirm = args.includes("--confirm");

    // 1. Verify SMTP Connection first
    console.log("Checking mail server connection...");
    try {
        await verifyMailConnection();
        console.log("✅ Mail server connection authenticated.\n");
    } catch (err) {
        console.error("❌ Mail connection failed:", err.message);
        process.exit(1);
    }

    // 2. Handle Test Send
    if (isTest) {
        const testIndex = args.indexOf("--test");
        const recipient = args[testIndex + 1];
        if (!recipient || recipient.startsWith("--")) {
            console.error("❌ Please provide a test recipient email. Example:");
            console.error("   node scripts/broadcast-update.js --test badalsahani1221@gmail.com");
            process.exit(1);
        }

        console.log(`Sending single test announcement to: ${recipient}...`);
        try {
            await sendAppReleaseEmail(recipient, "Test User");
            console.log(`\n🎉 Success! Check your inbox at ${recipient}.`);
        } catch (err) {
            console.error("❌ Failed to send test email:", err.message);
        }
        process.exit(0);
    }

    // 3. Connect to Database for dry-run or live broadcast
    const mongoUri = process.env.MONGO_URI || process.env.DB_URI;
    if (!mongoUri) {
        console.error("❌ MONGO_URI or DB_URI not found in backend/.env");
        process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB.\n");

    // Only query verified users with valid emails
    const users = await User.find({ isVerified: true })
        .select("name email isVerified")
        .lean();

    console.log(`Found ${users.length} verified users in the database.\n`);

    if (isDryRun || (!isBroadcast && !isTest)) {
        console.log("--- DRY RUN MODE (No emails sent) ---");
        console.log("The following users would receive the announcement:");
        users.slice(0, 10).forEach((u, idx) => {
            console.log(`  ${idx + 1}. ${u.name || "User"} <${u.email}>`);
        });
        if (users.length > 10) {
            console.log(`  ... and ${users.length - 10} more.`);
        }

        console.log("\nTo test sending to your own email first:");
        console.log("  node scripts/broadcast-update.js --test your-email@gmail.com\n");
        console.log("To send to all verified users when ready:");
        console.log("  node scripts/broadcast-update.js --broadcast --confirm\n");
        process.exit(0);
    }

    // 4. Live Broadcast with confirmation safeguard
    if (isBroadcast) {
        if (!hasConfirm) {
            console.error("⚠️ SAFETY CHECK: You must provide --confirm to send to all users.");
            console.error("   Run: node scripts/broadcast-update.js --broadcast --confirm");
            process.exit(1);
        }

        console.log(`🚀 Starting broadcast to ${users.length} users with rate-limiting (4/sec)...`);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const current = i + 1;

            try {
                process.stdout.write(`[${current}/${users.length}] Sending to ${user.email}... `);
                await sendAppReleaseEmail(user.email, user.name);
                successCount++;
                console.log("✅");
            } catch (err) {
                failCount++;
                console.log(`❌ (${err.message})`);
            }

            // 250ms delay between emails (max 4 per second) to stay safe with Brevo rate limits
            if (i < users.length - 1) {
                await sleep(250);
            }
        }

        console.log("\n=== Broadcast Summary ===");
        console.log(`Total recipients: ${users.length}`);
        console.log(`Successfully sent: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        console.log("=========================\n");

        process.exit(0);
    }
}

main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
