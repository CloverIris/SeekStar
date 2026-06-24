export interface DomainLexiconTerm {
  id: string;
  canonical: string;
  labels: Record<string, string>;
  enabled: boolean;
  tags?: string[];
}

export interface DomainLexicon {
  id: string;
  title: string;
  description: string;
  active: boolean;
  terms: DomainLexiconTerm[];
  updated_at: string;
}

export const DEFAULT_DOMAIN_LEXICON_ID = "human-knowledge-domains";

const defaultUpdatedAt = "2026-06-24T00:00:00.000Z";

export const DEFAULT_DOMAIN_LEXICONS: DomainLexicon[] = [
  {
    id: DEFAULT_DOMAIN_LEXICON_ID,
    title: "Human Knowledge Domains",
    description: "Default L0 domain vocabulary for broad human knowledge exploration.",
    active: true,
    updated_at: defaultUpdatedAt,
    terms: [
      domain("natural-sciences", "Natural sciences", "自然科学", "自然科學", ["science", "nature"]),
      domain("mathematics", "Mathematics", "数学", "數學", ["formal", "logic"]),
      domain("computing", "Computing", "计算机科学", "計算機科學", ["technology", "software"]),
      domain("engineering", "Engineering", "工程", "工程", ["technology", "systems"]),
      domain("medicine-health", "Medicine and health", "医学与健康", "醫學與健康", ["life", "clinical"]),
      domain("social-sciences", "Social sciences", "社会科学", "社會科學", ["society", "behavior"]),
      domain("humanities", "Humanities", "人文学科", "人文學科", ["culture", "meaning"]),
      domain("arts-design", "Arts and design", "艺术与设计", "藝術與設計", ["creative", "media"]),
      domain("business-economics", "Business and economics", "商业与经济", "商業與經濟", ["markets", "organizations"]),
      domain("law-governance", "Law and governance", "法律与治理", "法律與治理", ["policy", "institutions"]),
      domain("education", "Education", "教育", "教育", ["learning", "pedagogy"]),
      domain("environment", "Environment", "环境", "環境", ["earth", "sustainability"]),
      domain("history", "History", "历史", "歷史", ["time", "civilization"]),
      domain("philosophy", "Philosophy", "哲学", "哲學", ["reason", "values"]),
      domain("language", "Language and linguistics", "语言与语言学", "語言與語言學", ["communication", "translation"]),
      domain("daily-life", "Daily life", "日常生活", "日常生活", ["practice", "needs"]),
    ],
  },
];

export function cloneDomainLexicons(lexicons: readonly DomainLexicon[] = DEFAULT_DOMAIN_LEXICONS): DomainLexicon[] {
  return lexicons.map((lexicon) => ({
    ...lexicon,
    terms: lexicon.terms.map((term) => ({
      ...term,
      labels: { ...term.labels },
      tags: term.tags ? [...term.tags] : undefined,
    })),
  }));
}

export function resolveActiveDomainLexicon(
  lexicons: readonly DomainLexicon[] | undefined,
  activeLexiconId?: string,
): DomainLexicon {
  const candidates = lexicons && lexicons.length > 0 ? lexicons : DEFAULT_DOMAIN_LEXICONS;
  return (
    candidates.find((lexicon) => lexicon.id === activeLexiconId) ??
    candidates.find((lexicon) => lexicon.active) ??
    candidates[0] ??
    DEFAULT_DOMAIN_LEXICONS[0]
  );
}

function domain(
  id: string,
  canonical: string,
  zhHans: string,
  zhHant: string,
  tags: string[],
): DomainLexiconTerm {
  return {
    id,
    canonical,
    labels: {
      en: canonical,
      "zh-Hans": zhHans,
      "zh-Hant": zhHant,
    },
    enabled: true,
    tags,
  };
}
