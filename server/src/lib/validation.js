import { z } from "zod";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date in YYYY-MM-DD format.").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date.");

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid record.");

const phoneSchema = z.string().trim().max(30, "Phone number is too long.").refine((value) => {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  return /^[+]?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}, "Enter a valid phone number with 7 to 15 digits.");

const pinSchema = z.string().regex(/^\d{4,12}$/, "Admin PIN must contain 4 to 12 digits.");

const plateNumberSchema = z.string()
  .trim()
  .min(2, "Plate number must be at least 2 characters.")
  .max(30, "Plate number is too long.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9 .-]*$/, "Plate number can use letters, numbers, spaces, dots, and hyphens.")
  .transform((value) => value.toUpperCase());

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password is too long.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/\d/, "Password must include a number.");

const dateRangeSchema = z.object({
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional()
}).refine(({ from, to }) => !from || !to || from <= to, {
  message: "From date cannot be after To date."
});

function parseDateRange(query) {
  return dateRangeSchema.safeParse({
    from: typeof query.from === "string" && query.from ? query.from : undefined,
    to: typeof query.to === "string" && query.to ? query.to : undefined
  });
}

export {
  objectIdSchema,
  parseDateRange,
  passwordSchema,
  phoneSchema,
  pinSchema,
  plateNumberSchema
};
