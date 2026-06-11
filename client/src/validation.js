import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid record.");
const optionalDateSchema = z.string().refine(
  (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
  "Enter a valid date."
);
const dateRangeFields = {
  from: optionalDateSchema,
  to: optionalDateSchema
};

const phoneSchema = z.string().trim().max(30, "Phone number is too long.").refine((value) => {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  return /^[+]?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}, "Enter a valid phone number with 7 to 15 digits.");

const optionalEmailSchema = z.string().trim().max(254, "Email address is too long.").refine(
  (value) => !value || z.email().safeParse(value).success,
  "Enter a valid email address."
);

const pinSchema = z.string().regex(/^\d{4,12}$/, "Admin PIN must contain 4 to 12 digits.");

const clientFormSchema = z.object({
  name: z.string().trim().min(2, "Client name must be at least 2 characters.").max(100, "Client name is too long."),
  phone: phoneSchema,
  email: optionalEmailSchema,
  address: z.string().trim().max(250, "Address is too long."),
  active: z.boolean()
});

const vehicleFormSchema = z.object({
  plateNumber: z.string()
    .trim()
    .min(2, "Plate number must be at least 2 characters.")
    .max(30, "Plate number is too long.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9 .-]*$/, "Plate number can use letters, numbers, spaces, dots, and hyphens.")
    .transform((value) => value.toUpperCase()),
  label: z.string().trim().max(80, "Vehicle label is too long."),
  tripCounter: z.number().int("Trip counter must be a whole number.").min(0, "Trip counter cannot be negative."),
  receiptCounter: z.number().int("Receipt counter must be a whole number.").min(0, "Receipt counter cannot be negative."),
  active: z.boolean()
});

const staffFormSchema = z.object({
  name: z.string().trim().min(2, "Staff name must be at least 2 characters.").max(80, "Staff name is too long."),
  email: z.email("Enter a valid email address.").max(254, "Email address is too long.").transform((value) => value.toLowerCase()),
  password: z.string()
    .min(8, "Password must be at least 8 characters.")
    .max(100, "Password is too long.")
    .regex(/[A-Za-z]/, "Password must include a letter.")
    .regex(/\d/, "Password must include a number.")
});

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(254, "Email address is too long.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters.").max(100, "Password is too long.")
});

const deliveryFormSchema = z.object({
  deliveryDate: z.string().refine((value) => value && !Number.isNaN(new Date(value).getTime()), "Enter a valid delivery date and time."),
  clientId: objectIdSchema,
  vehicleId: objectIdSchema,
  note: z.string().trim().max(500, "Note cannot exceed 500 characters.")
});

const editDeliverySchema = deliveryFormSchema.omit({ vehicleId: true });

const deliveryFiltersSchema = z.object({
  search: z.string().trim().max(100, "Search text is too long."),
  clientId: z.union([z.literal(""), objectIdSchema]),
  vehicleId: z.union([z.literal(""), objectIdSchema]),
  receipt: z.string().refine((value) => !value || /^\d+$/.test(value) && Number(value) > 0, "Receipt number must be a positive whole number."),
  ...dateRangeFields
}).refine(({ from, to }) => !from || !to || from <= to, {
  message: "From date cannot be after To date."
});

const reportFiltersSchema = z.object({
  type: z.enum(["client", "vehicle", "range", "summary"]),
  clientId: z.string(),
  vehicleId: z.string(),
  ...dateRangeFields
}).superRefine((value, context) => {
  if (value.type === "client" && !objectIdSchema.safeParse(value.clientId).success) {
    context.addIssue({ code: "custom", message: "Select a client." });
  }
  if (value.type === "vehicle" && !objectIdSchema.safeParse(value.vehicleId).success) {
    context.addIssue({ code: "custom", message: "Select a vehicle." });
  }
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", message: "From date cannot be after To date." });
  }
});

const settingsSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters.").max(100, "Company name is too long."),
  soundsEnabled: z.boolean(),
  adminPin: z.union([z.literal(""), pinSchema])
});

function validateForm(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return { data: result.data, error: null };
  return { data: null, error: result.error.issues[0]?.message || "Check the entered information." };
}

function numericInput(value, maxLength = 12) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export {
  clientFormSchema,
  deliveryFiltersSchema,
  deliveryFormSchema,
  editDeliverySchema,
  loginSchema,
  numericInput,
  pinSchema,
  reportFiltersSchema,
  settingsSchema,
  staffFormSchema,
  validateForm,
  vehicleFormSchema
};
