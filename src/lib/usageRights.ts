import type { CatalogItem } from "./types";

export type UsageKind =
  | "public-domain"
  | "cc-by"
  | "cc-by-sa"
  | "no-known"
  | "user"
  | "unknown";

export type UsageRightsSummary = {
  kind: UsageKind;
  /** Compact line under the card meta */
  short: string;
  /** Longer hint for title tooltip */
  detail: string;
};

const PD = {
  kind: "public-domain" as const,
  short: "可商用、可二创",
  detail: "公有领域 / CC0 / PDM：署名非必须，建议注明来源",
};

const BY = {
  kind: "cc-by" as const,
  short: "需署名 · 可商用/二创",
  detail: "CC BY：署名后可商用与二创（请保留作者与许可声明）",
};

const BY_SA = {
  kind: "cc-by-sa" as const,
  short: "需署名+相同许可 · 可商用/二创",
  detail: "CC BY-SA：署名后可商用与二创，再分发需相同许可",
};

const NO_KNOWN = {
  kind: "no-known" as const,
  short: "馆方未见限制 · 谨慎商用",
  detail: "馆方未见已知限制；建议谨慎商用并保留来源",
};

const USER = {
  kind: "user" as const,
  short: "未知或用户提供 · 谨慎使用",
  detail: "许可未明确或由用户标注；请自行核实后再用",
};

const UNKNOWN = {
  kind: "unknown" as const,
  short: "未知许可 · 谨慎使用",
  detail: "无法识别许可条款，建议谨慎使用或仅作灵感参考",
};

function normalize(license: string) {
  return license.trim().toLowerCase();
}

function isVagueUserLicense(license: string) {
  const text = normalize(license);
  return (
    !text ||
    /用户提供|来源见标注|见标注|unknown|未注明|未提供|n\/a|none/.test(text)
  );
}

/**
 * Map catalog license + source to a short Chinese usage summary for gallery cards.
 */
export function summarizeUsageRights(
  item: Pick<CatalogItem, "license" | "source" | "licenseUrl">,
): UsageRightsSummary {
  const license = item.license ?? "";
  const text = normalize(license);
  const url = normalize(item.licenseUrl ?? "");
  const blob = `${text} ${url}`;

  if (item.source === "user" && isVagueUserLicense(license)) {
    return USER;
  }

  // BY-SA before BY (substring)
  if (
    /\bby[- ]?sa\b/.test(blob) ||
    /creativecommons\.org\/licenses\/by-sa\//.test(blob) ||
    /^by-sa$/.test(text)
  ) {
    return BY_SA;
  }

  if (
    /\bcc0\b/.test(blob) ||
    /\bpdm\b/.test(blob) ||
    /public[- ]?domain/.test(blob) ||
    /\bpd[- ]/.test(blob) ||
    /^pd$/.test(text) ||
    /creativecommons\.org\/publicdomain\//.test(blob) ||
    /creativecommons\.org\/share-your-work\/public-domain\/cc0/.test(blob)
  ) {
    // LOC-style "no known restrictions" often paired with PD wording
    if (/no known restrictions/.test(blob) && !/\bcc0\b|\bpdm\b|^cc0$|^pdm$/.test(text)) {
      return NO_KNOWN;
    }
    return PD;
  }

  if (
    /^by$/.test(text) ||
    /\bcc[- ]?by\b/.test(blob) ||
    /creativecommons\.org\/licenses\/by\//.test(blob) ||
    (/creative commons attribution/.test(blob) && !/share[- ]?alike|by-sa/.test(blob))
  ) {
    if (/non-?commercial|\bn[cd]\b|no[- ]derivatives/.test(blob)) {
      return UNKNOWN;
    }
    return BY;
  }

  if (/no known restrictions/.test(blob) || (item.source === "loc" && !text)) {
    return NO_KNOWN;
  }

  if (item.source === "user") {
    return USER;
  }

  return UNKNOWN;
}
