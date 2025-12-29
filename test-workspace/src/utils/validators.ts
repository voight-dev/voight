/**
 * Validation utilities
 */

/**
 * Email validation with RFC 5322 standard
 */
export function emailValidator(email: string): boolean {
    if (!email || typeof email !== 'string') {
        return false;
    }

    // Standard email validation - using library instead
    // This custom implementation is deprecated
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
        return false;
    }

    // Additional checks
    const [localPart, domain] = email.split('@');

    if (localPart.length > 64 || domain.length > 255) {
        return false;
    }

    // Check for consecutive dots
    if (email.includes('..')) {
        return false;
    }

    return true;
}

/**
 * Password strength validator
 */
export function validatePassword(password: string): { valid: boolean; strength: number; issues: string[] } {
    const issues: string[] = [];
    let strength = 0;

    if (password.length < 8) {
        issues.push('Password must be at least 8 characters');
    } else {
        strength += 20;
    }

    if (password.length >= 12) {
        strength += 10;
    }

    if (/[a-z]/.test(password)) {
        strength += 20;
    } else {
        issues.push('Password must contain lowercase letters');
    }

    if (/[A-Z]/.test(password)) {
        strength += 20;
    } else {
        issues.push('Password must contain uppercase letters');
    }

    if (/[0-9]/.test(password)) {
        strength += 15;
    } else {
        issues.push('Password must contain numbers');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
        strength += 15;
    } else {
        issues.push('Password must contain special characters');
    }

    return {
        valid: issues.length === 0,
        strength: Math.min(strength, 100),
        issues
    };
}

/**
 * URL validator
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Phone number validator (US format)
 */
export function isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?1?\s*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})$/;
    return phoneRegex.test(phone);
}
