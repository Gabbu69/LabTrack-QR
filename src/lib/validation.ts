import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export const registrationSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  studentId: z.string().trim().min(2, "Enter your Student ID.").max(40),
  yearSection: z.string().trim().min(2, "Enter your year and section.").max(60),
  groupNumber: z.string().trim().min(1, "Enter your group number.").max(30),
  contactNumber: z.string().trim().min(7, "Enter a valid contact number.").max(30),
});

export const passwordSchema = z.object({
  password: z.string().min(10).max(128).regex(/[A-Za-z]/, "Include a letter.").regex(/[0-9]/, "Include a number."),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, { path: ["confirmation"], message: "Passwords do not match." });

export const mfaCodeSchema = z.object({
  factorId: z.uuid(),
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the six-digit code from your authenticator."),
});

export const mfaNameSchema = z.string().trim().max(60, "Use an authenticator name of at most 60 characters.");

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120), studentId: z.string().trim().max(40),
  yearSection: z.string().trim().max(60), groupNumber: z.string().trim().max(30),
  contactNumber: z.string().trim().max(30),
});

export const toolBatchSchema = z.object({
  toolName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  category: z.string().trim().min(2).max(80),
  quantity: z.coerce.number().int().min(1).max(100),
  codePrefix: z.string().trim().regex(/^[A-Za-z0-9-]{2,12}$/),
  condition: z.enum(["good", "fair"]),
});
