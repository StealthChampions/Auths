/**
 * Icon URL Utilities | 图标 URL 工具
 *
 * Automatically detects domains for service icons without manual mapping.
 * 自动检测服务图标的域名，无需手动映射。
 */

// Common email providers that should be ignored when detecting icons
const COMMON_EMAIL_PROVIDERS = new Set([
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'yahoo.com',
    'yahoo.co.jp',
    'icloud.com',
    'me.com',
    'mac.com',
    'qq.com',
    '163.com',
    '126.com',
    'sina.com',
    'protonmail.com',
    'proton.me',
    'mail.com',
    'zoho.com',
    'aol.com',
    'yandex.com',
    'gmx.com',
    'gmx.net',
]);

// Generic/placeholder issuer names that should be ignored
const GENERIC_ISSUERS = new Set([
    'unknown',
    'n/a',
    'na',
    'none',
    'other',
    'default',
    '2fa',
    'otp',
    'totp',
    'hotp',
]);

// Common suffixes to remove from issuer names
const COMMON_SUFFIXES = [
    'account',
    'accounts',
    'service',
    'services',
    'app',
    'login',
    'auth',
    'authenticator',
    'security',
    'id',
    '2fa',
    'mfa',
    'otp',
];

// Services that don't use .com domains - minimal exceptions list
// 不使用 .com 域名的服务 - 最小例外列表
const DOMAIN_EXCEPTIONS: Record<string, string> = {
    'mega': 'mega.nz',
    'proton': 'proton.me',
    'protonmail': 'proton.me',
    'telegram': 'telegram.org',
    'twitch': 'twitch.tv',
    'notion': 'notion.so',
    'bitbucket': 'bitbucket.org',
    'huggingface': 'huggingface.co',
    'sentry': 'sentry.io',
};

/**
 * Extract a domain from a string that might contain one.
 * e.g., "Example.com--12345" -> "example.com"
 */
const extractDomainFromString = (str: string): string | null => {
    if (!str) return null;

    // Match domain-like patterns (e.g., "example.com", "sub.example.co.uk")
    const domainMatch = str.match(/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/);
    if (domainMatch) {
        const domain = domainMatch[0].toLowerCase();
        // Ignore common email providers
        if (!COMMON_EMAIL_PROVIDERS.has(domain)) {
            return domain;
        }
    }
    return null;
};

/**
 * Get the domain URL for fetching a favicon.
 * Priority: issuer name > domain in account > email domain
 *
 * @param issuer - The issuer/service name (e.g., "Google", "GitHub")
 * @param account - Optional account identifier (e.g., email "user@example.com")
 * @returns The detected domain or null
 */
export const getIconUrl = (issuer: string, account?: string): string | null => {
    const lowerIssuer = (issuer || '').toLowerCase().trim();

    // Check if issuer is a generic placeholder
    const isGenericIssuer = !lowerIssuer || GENERIC_ISSUERS.has(lowerIssuer);

    // 1. If issuer is NOT generic, try to use it
    if (!isGenericIssuer) {
        // Check if issuer itself looks like a full domain (e.g., "github.com")
        if (lowerIssuer.match(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/)) {
            return lowerIssuer;
        }

        // Clean issuer name
        let cleanIssuer = lowerIssuer
            .replace(/\s*\(.*?\)\s*/g, '')  // Remove parenthetical content
            .trim();

        // Remove common suffixes (e.g., "Nintendo Account" -> "Nintendo")
        for (const suffix of COMMON_SUFFIXES) {
            const suffixPattern = new RegExp(`\\s+${suffix}$`, 'i');
            cleanIssuer = cleanIssuer.replace(suffixPattern, '');
        }

        // Remove remaining non-alphanumeric chars and use as domain
        cleanIssuer = cleanIssuer.replace(/[^a-z0-9]/g, '').trim();

        if (cleanIssuer) {
            // Check exceptions first (non-.com domains)
            if (DOMAIN_EXCEPTIONS[cleanIssuer]) {
                return DOMAIN_EXCEPTIONS[cleanIssuer];
            }
            return `${cleanIssuer}.com`;
        }
    }

    // 2. Try to extract domain from account string (e.g., "OKEx.com--123456")
    if (account) {
        const domainFromAccount = extractDomainFromString(account);
        if (domainFromAccount) {
            return domainFromAccount;
        }

        // Also try email extraction (user@example.com)
        if (account.includes('@')) {
            const parts = account.split('@');
            if (parts.length === 2) {
                const emailDomain = parts[1].toLowerCase().trim();
                if (
                    emailDomain.includes('.') &&
                    !emailDomain.match(/\.(local|test|localhost)$/) &&
                    !COMMON_EMAIL_PROVIDERS.has(emailDomain)
                ) {
                    return emailDomain;
                }
            }
        }
    }

    return null;
};
