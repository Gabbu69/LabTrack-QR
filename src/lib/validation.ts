import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const registrationSchema = loginSchema.extend({
  fullName: z.string().trim().min(2).max(120),
  studentId: z.string().trim().min(2).max(40),
  yearSection: z.string().trim().min(2).max(60),
  groupNumber: z.string().trim().min(1).max(30),
  contactNumber: z.string().trim().min(7).max(30),
});

export const passwordSchema = z.object({
  password: z.string().min(10).regex(/[A-Za-z]/, "Include a letter.").regex(/[0-9]/, "Include a number."),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, { path: ["confirmation"], message: "Passwords do not match." });

export const toolBatchSchema = z.object({
  toolName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  category: z.string().trim().min(2).max(80),
  quantity: z.coerce.number().int().min(1).max(100),
  codePrefix: z.string().trim().regex(/^[A-Za-z0-9-]{2,12}$/),
  condition: z.enum(["good", "fair"]),
});
