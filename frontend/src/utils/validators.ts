export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: 'Email address is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  return { valid: true };
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  let passed = 0;
  if (checks.minLength) passed += 1;
  if (checks.hasUppercase) passed += 1;
  if (checks.hasLowercase) passed += 1;
  if (checks.hasNumber) passed += 1;
  if (checks.hasSpecial) passed += 1;

  if (!password) {
    return { score: 0, label: 'Very Weak', checks };
  }
  if (passed <= 1) {
    return { score: 1, label: 'Weak', checks };
  }
  if (passed === 2 || passed === 3) {
    return { score: 2, label: 'Fair', checks };
  }
  if (passed === 4) {
    return { score: 3, label: 'Strong', checks };
  }
  return { score: 4, label: 'Very Strong', checks };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return {
      valid: false,
      error: 'Password must include uppercase, lowercase, and at least one number.',
    };
  }
  return { valid: true };
}

export function validateDisplayName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Display name is required.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Display name must be at least 2 characters.' };
  }
  if (trimmed.length > 80) {
    return { valid: false, error: 'Display name must be 80 characters or fewer.' };
  }
  return { valid: true };
}

export function validateImageFile(file: File): ValidationResult {
  const allowedTypes: readonly string[] = ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPG, PNG, or WebP image.',
    };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image is too large (${(file.size / (1024 * 1024)).toFixed(
        1
      )} MB). Maximum allowed size is ${MAX_IMAGE_SIZE_MB} MB.`,
    };
  }
  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected file is empty.',
    };
  }
  return { valid: true };
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: `${fieldName} is required.` };
  }
  return { valid: true };
}
