import { config } from "dotenv";
config();
import prisma from "../config/prisma.js";
import { v4 as uuidv4 } from "uuid";

async function createTestKey() {
  const TEST_KEY = "test_key_7c16227d-9f39-42d1-93a1-bec4b7d4954c";
  const TEST_EMAIL = "test_user@example.com";

  console.log("🚀 Creating test API key...");

  try {
    // 1. Find or create a test user
    let user = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
    });

    if (!user) {
      console.log("👤 Creating test user...");
      user = await prisma.user.create({
        data: {
          firstName: "Test",
          lastName: "User",
          email: TEST_EMAIL,
          password: "password123", // Dummy password
          emailVerified: true,
        },
      });
      console.log("✅ Created test user:", user.id);
    } else {
      console.log("👤 Found existing test user:", user.id);
    }

    // 2. Check if the key already exists
    const existingKey = await prisma.apiKey.findUnique({
      where: { key: TEST_KEY },
    });

    if (existingKey) {
      console.log("ℹ️  Test key already exists.");
      return;
    }

    // 3. Create the API key
    const newKey = await prisma.apiKey.create({
      data: {
        key: TEST_KEY,
        ownerId: user.id,
      },
    });

    console.log("✅ Created test API key:", newKey.key);
    console.log("🔑 Owner ID:", newKey.ownerId);
  } catch (error) {
    console.error("❌ Error creating test key:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestKey();
