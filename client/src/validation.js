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
const optionalPersonFilter = z.string().trim().max(80, "Filter value is too long.");
const receiptFilterSchema = z.string()
  .trim()
  .max(30, "Receipt number is too long.")
  .refine((value) => !value || /^\d+$/.test(value), "Receipt number must contain digits only.");

const phoneSchema = z.string().trim().max(30, "Phone number is too long.").refine((value) => {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  return /^[+]?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}, "Enter a valid phone number with 7 to 15 digits.");

const optionalEmailSchema = z.string().trim().max(254, "Email address is too long.").refine(
  (value) => !value || z.email().safeParse(value).success,
  "Enter a valid email address."
);

const requiredName = (label) => z.string().trim().min(1, `${label} is required.`).max(80, `${label} is too long.`);
const requiredNumber = (label, options = {}) => z.union([z.number(), z.string()])
  .transform((value) => value === "" || value === null ? NaN : Number(value))
  .refine((value) => !Number.isNaN(value), `${label} is required.`)
  .refine((value) => !options.integer || Number.isInteger(value), `${label} must be a whole number.`)
  .refine((value) => value >= (options.min ?? 0), options.minMessage ?? `${label} cannot be negative.`);
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
  itemSize: requiredNumber("Item size", { integer: true, min: 1, minMessage: "Item size is required." }),
  amount: requiredNumber("Amount", { min: 1, minMessage: "Amount is required." }),
  receiptSerialNo: z.string().trim().min(1, "Receipt serial number is required.").max(30, "Receipt serial number is too long."),
  tripCounter: requiredNumber("Starting trip no.", { integer: true, min: 0, minMessage: "Starting trip no. cannot be negative." }),
  receiptCounter: requiredNumber("Starting receipt no.", { integer: true, min: 0, minMessage: "Starting receipt no. cannot be negative." }),
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
  driverName: requiredName("Driver"),
  staffName: requiredName("Staff"),
  balance: z.number().min(0, "Balance cannot be negative."),
  note: z.string().trim().max(500, "Note cannot exceed 500 characters.")
});

const editDeliverySchema = z.object({
  deliveryDate: z.string().refine((value) => value && !Number.isNaN(new Date(value).getTime()), "Enter a valid delivery date and time."),
  clientId: objectIdSchema,
  driverName: requiredName("Driver"),
  staffName: requiredName("Staff"),
  balance: z.number().min(0, "Balance cannot be negative."),
  note: z.string().trim().max(500, "Note cannot exceed 500 characters.")
});

const deliveryFiltersSchema = z.object({
  search: z.string().trim().max(100, "Search text is too long."),
  clientId: z.union([z.literal(""), objectIdSchema]),
  vehicleId: z.union([z.literal(""), objectIdSchema]),
  driverName: optionalPersonFilter,
  staffName: optionalPersonFilter,
  receipt: receiptFilterSchema,
  ...dateRangeFields
}).refine(({ from, to }) => !from || !to || from <= to, {
  message: "From date cannot be after To date."
});

const reportFiltersSchema = z.object({
  clientId: z.union([z.literal(""), objectIdSchema]),
  vehicleId: z.union([z.literal(""), objectIdSchema]),
  driverName: optionalPersonFilter,
  staffName: optionalPersonFilter,
  receipt: receiptFilterSchema,
  ...dateRangeFields
}).refine(({ from, to }) => !from || !to || from <= to, {
  message: "From date cannot be after To date."
});

const settingsSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters.").max(100, "Company name is too long."),
  companyPhoneNumber: phoneSchema,
  reporterName: z.string().trim().max(80, "Reporter name is too long."),
  reporterTitle: z.string().trim().max(80, "Reporter title is too long."),
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
