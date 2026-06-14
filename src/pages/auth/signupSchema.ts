import { z } from 'zod';

// Allows letters (including accented), spaces, hyphens, apostrophes — 2–50 chars.
const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,50}$/;

/** Strip everything except digits. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Format as US phone while typing — caps at 10 digits. */
export function formatUsPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Returns the 10-digit string, or null if empty. */
export function normalizeUsPhone(value: string): string | null {
  const digits = onlyDigits(value);
  if (!digits) return null;
  return digits.slice(0, 10);
}

function isValidOptionalUsPhone(value: string): boolean {
  const digits = onlyDigits(value);
  if (!digits) return true; // optional
  return digits.length === 10;
}

const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

export const signupSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'First name is required.')
      .regex(nameRegex, 'Enter a valid first name (letters, spaces, hyphens).'),
    lastName: z
      .string()
      .min(1, 'Last name is required.')
      .regex(nameRegex, 'Enter a valid last name (letters, spaces, hyphens).'),
    email: z
      .string()
      .min(1, 'Email address is required.')
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address.'),
    phone: z
      .string()
      .refine(isValidOptionalUsPhone, 'Enter a valid 10-digit phone number.'),
    businessAddress: z
      .object({
        street: z.string(),
        street2: z.string(),
        city: z.string(),
        state: z.string(),
        postalCode: z.string(),
      })
      .superRefine((addr, ctx) => {
        // If every field is empty, the whole address block is optional — no errors.
        const hasAny = [addr.street, addr.city, addr.state, addr.postalCode].some((f) =>
          f.trim(),
        );
        if (!hasAny) return;

        if (!addr.street.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'Street address is required.',
            path: ['street'],
          });
        }
        if (!addr.city.trim()) {
          ctx.addIssue({ code: 'custom', message: 'City is required.', path: ['city'] });
        }
        if (!addr.state.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'State / territory is required.',
            path: ['state'],
          });
        }
        const zip = addr.postalCode.trim();
        if (!zip) {
          ctx.addIssue({ code: 'custom', message: 'ZIP code is required.', path: ['postalCode'] });
        } else if (!ZIP_REGEX.test(zip)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Enter a valid ZIP code (12345 or 12345-6789).',
            path: ['postalCode'],
          });
        }
      }),
    password: z
      .string()
      .min(1, 'Password is required.')
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Za-z]/, 'Password must include at least one letter.')
      .regex(/[0-9]/, 'Password must include at least one number.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({
        message: 'You must accept the User Agreement and Privacy Policy.',
      }),
    }),
    // verificationAnswer is validated in onSubmit against a runtime value (not static schema).
    // NaN (empty number input) is coerced to undefined so it doesn't block Zod field errors.
    verificationAnswer: z.preprocess(
      (val) => (typeof val === 'number' && isNaN(val) ? undefined : val),
      z.number({ invalid_type_error: 'Please answer the verification question.' }).optional(),
    ),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignUpFormData = z.infer<typeof signupSchema>;
