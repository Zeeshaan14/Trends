import { z } from "zod"

export const checkoutSchema = z.object({
  companyName: z.string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must not exceed 100 characters")
    .trim(),
  email: z.string()
    .email("Invalid email address")
    .trim(),
  phone: z.string()
    .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number (must be 10 digits starting with 6-9)")
    .trim(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
