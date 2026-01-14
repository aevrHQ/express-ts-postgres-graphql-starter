import otpGenerator from "otp-generator";
import { EmailService } from "../utils/emails/index.js";
import prisma from "../config/prisma.js";
import { config } from "dotenv";

config();

const APP_URL = process.env.APP_URL;

const sendVerificationMail = async (
  email: string,
  otp: string,
  userName?: string
) => {
  const verificationLink = `${APP_URL}/auth/verify?email=${email}&otp=${otp}&sent=true`;
  try {
    // Initialize the email service with default provider from environment
    const emailService = new EmailService();

    // Generate a more professional-looking email template with the OTP
    const content = `
      <p>Your one-time verification code is:</p>
      <div style="text-align: center; margin: 25px 0;">
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 12px 24px; background-color: #f7f7f7; display: inline-block; border-radius: 4px;">${otp}</div>
        <br />
        <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #1a74e4; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 20px 0;">Verify Email</a>
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `;

    // Use the standard template for a consistent look and feel
    const emailBody = emailService.generateMinimalistTemplate({
      title: "Email Verification",
      content,
    });

    // Send the email using the new EmailService
    const mailResponse = await emailService.sendEmail({
      subject: "Email Verification Code",
      htmlBody: emailBody,
      to: {
        email,
        name: userName || email.split("@")[0], // Use userName if provided, otherwise use email username
      },
    });

    return mailResponse;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error(error.message || "Failed to send verification email");
  }
};

const initOTPGeneration = async (email: string) => {
  try {
    const normalizeEmail = email.toLowerCase().trim();
    // Check if user with email exists
    let user = await prisma.user.findUnique({
      where: { email: normalizeEmail },
      include: { loginOTP: true },
    });

    if (!user) {
      // Create new user if not exists
      const firstName = normalizeEmail.split("@")[0];
      try {
        user = await prisma.user.create({
          data: {
            email: normalizeEmail,
            firstName,
            lastName: "",
            roles: {
              connect: { name: "user" },
            },
          },
          include: { loginOTP: true },
        });
      } catch (error) {
        // Fallback if role "user" doesn't exist, create it (safe fallback)
        /* 
            Note: In a real app, you should ensure roles exist via seeding. 
            But here we try to handle it gracefully or let it fail if DB is broken.
         */
        if (error.code === "P2025") {
          // Record not found for relation
          user = await prisma.user.create({
            data: {
              email: normalizeEmail,
              firstName,
              lastName: "",
              roles: {
                create: { name: "user" },
              },
            },
            include: { loginOTP: true },
          });
        } else {
          throw error;
        }
      }
    }

    // Throttling
    if (user.loginOTP?.lastSentAt) {
      const timeSinceLast =
        Date.now() - new Date(user.loginOTP.lastSentAt).getTime();
      if (timeSinceLast < 60 * 1000) {
        throw new Error("Please wait 60 seconds before requesting a new code.");
      }
    }

    // Generate OTP - 6 digits
    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // Hash Code
    const crypto = await import("crypto");
    const codeHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Upsert LoginOTP
    // Since it's a 1:1 relation, we update or create.
    if (user.loginOTP) {
      await prisma.loginOTP.update({
        where: { userId: user.id },
        data: {
          codeHash,
          expiresAt,
          attempts: 0,
          lastSentAt: new Date(),
        },
      });
    } else {
      await prisma.loginOTP.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt,
          attempts: 0,
          lastSentAt: new Date(),
        },
      });
    }

    // Send verification email with user's name if available
    const mailResponse = await sendVerificationMail(
      user.email,
      otp,
      user.firstName
    );

    console.log("Email sent:", mailResponse);

    return {
      success: true,
      message: "OTP sent successfully",
    };
  } catch (error) {
    console.error("OTP generation error:", error);
    throw new Error(error.message || "Failed to generate OTP");
  }
};

export { sendVerificationMail, initOTPGeneration };
