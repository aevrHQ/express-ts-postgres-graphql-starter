import prisma from "../../config/prisma.js";
import { initOTPGeneration } from "../../services/otp.services.js";
import { userService } from "../../services/user.services.js";

const OTPResolvers = {
  Mutation: {
    requestOTP: async (parent, args, context, info) => {
      try {
        const email = args.email;
        if (!email) {
          throw new Error("Email is required");
        }

        const response = await initOTPGeneration(email);
        return response;
      } catch (error) {
        console.log("Mutation.requestOTP error", error);
        throw new Error(error.message || "Failed to request code");
      }
    },
    verifyOTP: async (parent, args, context, info) => {
      try {
        const { email, otp, shouldLogin } = args;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { loginOTP: true, roles: true },
        });

        if (!user || !user.loginOTP || !user.loginOTP.codeHash) {
          throw new Error("Invalid or expired code.");
        }

        if (new Date() > user.loginOTP.expiresAt) {
          throw new Error("Code has expired. Please request a new one.");
        }

        const crypto = await import("crypto");
        const inputHash = crypto.createHash("sha256").update(otp).digest("hex");

        if (inputHash !== user.loginOTP.codeHash) {
          await prisma.loginOTP.update({
            where: { userId: user.id },
            data: { attempts: (user.loginOTP.attempts || 0) + 1 },
          });
          throw new Error("Invalid code.");
        }

        // Success
        // 1. Mark Email Verified
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });

        // 2. Clean up OTP
        await prisma.loginOTP.delete({ where: { userId: user.id } });

        // 3. Generate Tokens if requested
        let authData = {};
        if (shouldLogin) {
          const tokens = await userService.generateAuthTokens(user);
          authData = tokens;
        }

        return {
          success: true,
          message: "Verification successful.",
          ...authData,
          user,
        };
      } catch (error) {
        console.log("Mutation.verifyOTP error", error);
        throw new Error(error.message || "Verification failed");
      }
    },
  },
};

export default OTPResolvers;
