export type FeatureFlag = {
  key: string;
  enabled: boolean;
  rolloutPercent?: number | undefined;
};

export function isFeatureEnabled(flag: FeatureFlag | undefined, stableSubjectId: string): boolean {
  if (!flag?.enabled) {
    return false;
  }

  if (flag.rolloutPercent === undefined || flag.rolloutPercent >= 100) {
    return true;
  }

  if (flag.rolloutPercent <= 0) {
    return false;
  }

  return bucket(stableSubjectId + flag.key) < flag.rolloutPercent;
}

function bucket(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 100;
}
