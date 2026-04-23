/**
 * AURA DETERMINISTIC MODERATION ENGINE
 * No AI. No Hallucinations. Pure Logic.
 */

export type ModerationStatus = 'allow' | 'flag' | 'block';

export interface ModerationResult {
  status: ModerationStatus;
  reasons: string[];
  score: {
    spam: number;
    offensive: number;
    hate: number;
    sexual: number;
    risk: number;
    total: number;
  };
  matchedRules: string[];
}

export interface ModerationConfig {
  blacklist: string[];      // Immediate block (Score 1.0)
  softlist: string[];       // Flagged terms (Score 0.4)
  restrictedUsernames: string[]; // Blocked for usernames
  bannedDomains: string[];  // Domains for link detection
  thresholds: {
    flag: number;
    block: number;
  };
}

export const DEFAULT_CONFIG: ModerationConfig = {
  blacklist: [
    'fuck', 'pussy', 'nazi', 'hitler', 'vagnord', 'vagra', 'cock', 'porn', 'sexo'
  ],
  softlist: [
    'idiot', 'stupid', 'dumb', 'maldito', 'lixo', 'buy now', 'promo'
  ],
  restrictedUsernames: [
    'admin', 'suporte', 'aura', 'moderator', 'oficial', 'staff'
  ],
  bannedDomains: [
    'bit.ly', 't.co', 'phishing-site.com'
  ],
  thresholds: {
    flag: 0.3,
    block: 0.7
  }
};

/**
 * Normalizes text for analysis
 * Removes accents, extra spaces, and reduces character repetition (eeee -> ee)
 */
export function normalizeContent(text: string): string {
  if (!text) return '';
  
  // 1. Lowercase and remove accents
  let normalized = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
    
  // 2. Remove non-alphanumeric characters but keep spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, (match) => {
    // Replace symbols that are often used to bypass filters
    const bypassMap: Record<string, string> = {
      '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '3': 'e', '$': 's', '7': 't', '8': 'b', '5': 's'
    };
    return bypassMap[match] || '';
  });

  // 3. Reduce character repetition (limit to 2 identical chars)
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');
  
  // 4. Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Runs the deterministic moderation analysis
 */
export function moderationEngine(
  content: string, 
  type: 'post' | 'comment' | 'username' | 'message',
  config: ModerationConfig = DEFAULT_CONFIG
): ModerationResult {
  const result: ModerationResult = {
    status: 'allow',
    reasons: [],
    score: {
      spam: 0,
      offensive: 0,
      hate: 0,
      sexual: 0,
      risk: 0,
      total: 0
    },
    matchedRules: []
  };

  if (!content) return result;

  const normalized = normalizeContent(content);
  const words = normalized.split(' ');

  // 1. Blacklist Check (HARD BLOCK)
  config.blacklist.forEach(term => {
    if (normalized.includes(term)) {
      result.score.risk += 1.0;
      result.reasons.push('blacklist_term');
      result.matchedRules.push(`BLACKLIST:${term}`);
    }
  });

  // 2. Softlist Check (FLAGGING)
  config.softlist.forEach(term => {
    if (normalized.includes(term)) {
      result.score.offensive += 0.4;
      result.reasons.push('offensive_language');
      result.matchedRules.push(`SOFTLIST:${term}`);
    }
  });

  // 3. Username Restrictions
  if (type === 'username') {
    config.restrictedUsernames.forEach(term => {
      if (normalized.includes(term)) {
        result.score.risk += 1.0;
        result.reasons.push('restricted_identity');
        result.matchedRules.push(`RESTRICTED_NAME:${term}`);
      }
    });
  }

  // 4. Spam & Flood Detection
  // Check for caps excess
  const capsCount = (content.match(/[A-Z]/g) || []).length;
  if (content.length > 10 && capsCount / content.length > 0.6) {
    result.score.spam += 0.5;
    result.reasons.push('excessive_caps');
  }

  // Check for excessive repetition (same word many times)
  const wordCounts: Record<string, number> = {};
  words.forEach(w => {
    if (w.length > 2) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
      if (wordCounts[w] > 4) {
        result.score.spam += 0.2;
        if (!result.reasons.includes('word_repetition')) result.reasons.push('word_repetition');
      }
    }
  });

  // 5. Link Detection
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  const links = content.match(linkRegex) || [];
  if (links.length > 2) {
     result.score.spam += 0.6;
     result.reasons.push('excessive_links');
  }
  
  links.forEach(link => {
    config.bannedDomains.forEach(domain => {
       if (link.includes(domain)) {
          result.score.risk += 0.8;
          result.reasons.push('banned_domain');
          result.matchedRules.push(`DOMAIN_BLOCK:${domain}`);
       }
    });
  });

  // Final Decision Logic
  result.score.total = Math.min(
    1.0, 
    result.score.risk + result.score.spam + result.score.offensive + result.score.hate + result.score.sexual
  );

  if (result.score.total >= config.thresholds.block) {
    result.status = 'block';
  } else if (result.score.total >= config.thresholds.flag) {
    result.status = 'flag';
  } else {
    result.status = 'allow';
  }

  return result;
}
