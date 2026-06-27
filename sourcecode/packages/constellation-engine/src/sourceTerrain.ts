import type { CreatedFromRef, LayerId, SourceRef, SourceSnapshot, SourceType, TerrainNode, TerrainRelation, TerrainScene } from "@seekstar/core-schema";

export interface SourceIngestionInput {
  title: string;
  url?: string;
  body?: string;
  snapshot?: SourceSnapshot;
  sourceType?: SourceType;
  retrievedAt?: string;
  reliabilityHints?: string[];
  tags?: string[];
  createdFrom?: CreatedFromRef;
  observationId?: string;
  initialLayer?: LayerId;
  materialization?: Partial<TextMaterializationProfile>;
}

export interface TextMaterializationProfile {
  paragraphLimit: number;
  sentenceLimitPerParagraph: number;
  phraseLimitPerSentence: number;
  wordLimitPerPhrase: number;
  wordsPerSentenceScanLimit: number;
  phraseWordScanLimit: number;
}

export interface SourceTerrainPatch {
  source: SourceRef;
  nodes: TerrainNode[];
  relations: TerrainRelation[];
}

interface TextTerrain {
  paragraphs: ParagraphGrain[];
}

interface TextRangeGrain {
  end: number;
  start: number;
  text: string;
  tokenEnd: number;
  tokenStart: number;
}

interface ParagraphGrain extends TextRangeGrain {
  sentences: SentenceGrain[];
}

interface SentenceGrain extends TextRangeGrain {
  phrases: PhraseGrain[];
}

interface PhraseGrain extends TextRangeGrain {
  words: WordGrain[];
}

interface WordGrain {
  end: number;
  start: number;
  text: string;
  tokenIndex: number;
}

let sourceCounter = 0;

export function createSourceTerrainPatch(input: SourceIngestionInput, scene: TerrainScene): SourceTerrainPatch {
  sourceCounter += 1;

  const snapshot = input.snapshot;
  const createdAt = input.retrievedAt ?? snapshot?.retrieved_at ?? new Date().toISOString();
  const title = normalizeTitle(input.title || snapshot?.title || snapshot?.final_url || snapshot?.url || "Untitled source");
  const sourceUrl = input.url?.trim() || snapshot?.final_url || snapshot?.url;
  const sourceText = normalizeBody(input.body ?? snapshot?.visible_text ?? snapshot?.excerpt ?? title);
  const materialization = resolveTextMaterializationProfile(input);
  const textTerrain = createTextTerrain(sourceText, materialization);
  const slug = toSlug(title);
  const stamp = `${Date.now()}-${sourceCounter}`;
  const sourceId = `source-${slug}-${stamp}`;
  const sourceNodeId = `node-${slug}-source-${stamp}`;
  const documentNodeId = `node-${slug}-document-${stamp}`;
  const anchor = getSourceAnchor(scene);
  const tags = input.tags ?? ["manual-ingest"];
  const scoutBacked = tags.includes("scout-observation");

  const source: SourceRef = {
    id: sourceId,
    title,
    url: sourceUrl || undefined,
    source_type: input.sourceType ?? snapshot?.source_type ?? (sourceUrl ? "webpage" : "document"),
    retrieved_at: createdAt,
    snippet: snapshot?.excerpt ?? textTerrain.paragraphs[0]?.text ?? sourceText.slice(0, 220),
    reliability_hints:
      input.reliabilityHints ??
      (snapshot
        ? [
            "observed by Playwright Scout adapter",
            snapshot.content_type ? `content type: ${snapshot.content_type}` : "content type unavailable",
            `${snapshot.outlinks.length} outlinks captured`,
            `${snapshot.media.length} media candidates captured`,
          ]
        : ["manual user-provided source", "not retrieved by Playwright"]),
    created_from_observation_id: input.observationId,
    source_snapshot: snapshot,
  };

  const sourceNode: TerrainNode = {
    id: sourceNodeId,
    type: "source",
    title,
    layer: "L2",
    source_state: "source_backed",
    confidence: 0.86,
    importance: 0.88,
    tags: ["source", "source-backed", ...tags],
    summary: source.snippet,
    source_id: source.id,
    source_url: source.url,
    source_title: source.title,
    source_type: source.source_type,
    retrieved_at: createdAt,
    created_from: input.createdFrom,
    child_ids: [documentNodeId],
    child_layer_id: "L3",
    zoom_target: { layer: "L3", node_id: documentNodeId },
    position_hint: anchor,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const documentNode = createSourceNode({
    createdAt,
    createdFrom: input.createdFrom,
    id: documentNodeId,
    layer: "L3",
    parentId: sourceNodeId,
    position: { x: anchor.x + 310, y: anchor.y },
    source,
    sourceRange: { source_id: source.id, locator: `${source.id}#document`, start: 0, end: sourceText.length, excerpt: sourceText.slice(0, 320) },
    summary: sourceText.slice(0, 360),
    tags: ["document-tile", "source-backed", ...tags],
    title,
    type: source.source_type === "webpage" ? "webpage" : "document",
  });
  const sectionNodeId = `node-${slug}-section-1-${stamp}`;
  const sectionNode = createSourceNode({
    createdAt,
    createdFrom: input.createdFrom,
    id: sectionNodeId,
    layer: "L4",
    parentId: documentNodeId,
    position: { x: anchor.x + 640, y: anchor.y - 120 },
    source,
    sourceRange: { source_id: source.id, locator: `${source.id}#section-1`, start: 0, end: sourceText.length, excerpt: sourceText.slice(0, 260) },
    summary: sourceText.slice(0, 280),
    tags: ["section", "source-backed", ...tags],
    title: createSectionTitle(title, sourceText),
    type: "section",
  });

  const nodes: TerrainNode[] = [sourceNode, documentNode, sectionNode];
  const relations: TerrainRelation[] = [
    createContainsRelation({
      from: sourceNodeId,
      id: `rel-${slug}-source-document-${stamp}`,
      scoutBacked,
      to: documentNodeId,
    }),
    createContainsRelation({
      from: documentNodeId,
      id: `rel-${slug}-document-section-1-${stamp}`,
      scoutBacked,
      to: sectionNodeId,
    }),
  ];

  const paragraphNodes = textTerrain.paragraphs.slice(0, materialization.paragraphLimit).map((paragraph, paragraphIndex) =>
    appendParagraphTerrain({
      anchor,
      createdAt,
      createdFrom: input.createdFrom,
      nodes,
      paragraph,
      paragraphIndex,
      relations,
      scoutBacked,
      sectionNodeId,
      slug,
      source,
      stamp,
      tags,
      materialization,
    }),
  );
  documentNode.child_ids = [sectionNodeId];
  documentNode.child_layer_id = "L4";
  documentNode.zoom_target = { layer: "L4", node_id: sectionNodeId };
  sectionNode.child_ids = paragraphNodes.map((node) => node.id);
  sectionNode.child_layer_id = "L5";
  sectionNode.zoom_target = paragraphNodes[0] ? { layer: "L5", node_id: paragraphNodes[0].id } : undefined;

  return {
    source,
    nodes,
    relations,
  };
}

function appendParagraphTerrain(input: {
  anchor: { x: number; y: number };
  createdAt: string;
  createdFrom?: CreatedFromRef;
  nodes: TerrainNode[];
  paragraph: ParagraphGrain;
  paragraphIndex: number;
  relations: TerrainRelation[];
  scoutBacked: boolean;
  sectionNodeId: string;
  slug: string;
  source: SourceRef;
  stamp: string;
  tags: string[];
  materialization: TextMaterializationProfile;
}): TerrainNode {
  const paragraphOrdinal = input.paragraphIndex + 1;
  const paragraphNodeId = `node-${input.slug}-paragraph-${paragraphOrdinal}-${input.stamp}`;
  const paragraphNode = createSourceNode({
    createdAt: input.createdAt,
    createdFrom: input.createdFrom,
    id: paragraphNodeId,
    layer: "L5",
    parentId: input.sectionNodeId,
    position: { x: input.anchor.x + 1000, y: input.anchor.y - 150 + input.paragraphIndex * 150 },
    source: input.source,
    sourceRange: {
      source_id: input.source.id,
      locator: `${input.source.id}#paragraph-${paragraphOrdinal}`,
      start: input.paragraph.start,
      end: input.paragraph.end,
      excerpt: input.paragraph.text,
    },
    summary: input.paragraph.text,
    tags: ["paragraph", "source-backed", ...input.tags],
    title: createExcerptTitle(input.paragraph.text, input.paragraphIndex),
    tokenRange: {
      source_id: input.source.id,
      start_token: input.paragraph.tokenStart,
      end_token: input.paragraph.tokenEnd,
      text: input.paragraph.text.slice(0, 120),
    },
    type: "paragraph",
  });

  input.nodes.push(paragraphNode);
  input.relations.push(
    createContainsRelation({
      from: input.sectionNodeId,
      id: `rel-${input.slug}-section-paragraph-${paragraphOrdinal}-${input.stamp}`,
      scoutBacked: input.scoutBacked,
      to: paragraphNodeId,
    }),
  );

  const sentenceNodes = input.paragraph.sentences.slice(0, input.materialization.sentenceLimitPerParagraph).map((sentence, sentenceIndex) =>
    appendSentenceTerrain({
      ...input,
      paragraphNodeId,
      sentence,
      sentenceIndex,
    }),
  );

  paragraphNode.child_ids = sentenceNodes.map((node) => node.id);
  paragraphNode.child_layer_id = sentenceNodes.length > 0 ? "L6" : undefined;
  paragraphNode.zoom_target = sentenceNodes[0] ? { layer: "L6", node_id: sentenceNodes[0].id } : undefined;

  return paragraphNode;
}

function appendSentenceTerrain(input: {
  anchor: { x: number; y: number };
  createdAt: string;
  createdFrom?: CreatedFromRef;
  nodes: TerrainNode[];
  paragraphIndex: number;
  paragraphNodeId: string;
  relations: TerrainRelation[];
  scoutBacked: boolean;
  sentence: SentenceGrain;
  sentenceIndex: number;
  slug: string;
  source: SourceRef;
  stamp: string;
  tags: string[];
  materialization: TextMaterializationProfile;
}): TerrainNode {
  const paragraphOrdinal = input.paragraphIndex + 1;
  const sentenceOrdinal = input.sentenceIndex + 1;
  const sentenceNodeId = `node-${input.slug}-sentence-${paragraphOrdinal}-${sentenceOrdinal}-${input.stamp}`;
  const sentenceNode = createSourceNode({
    createdAt: input.createdAt,
    createdFrom: input.createdFrom,
    id: sentenceNodeId,
    layer: "L6",
    parentId: input.paragraphNodeId,
    position: { x: input.anchor.x + 1390, y: input.anchor.y - 164 + input.paragraphIndex * 150 + input.sentenceIndex * 72 },
    source: input.source,
    sourceRange: {
      source_id: input.source.id,
      locator: `${input.source.id}#sentence-${paragraphOrdinal}-${sentenceOrdinal}`,
      start: input.sentence.start,
      end: input.sentence.end,
      excerpt: input.sentence.text,
    },
    summary: input.sentence.text,
    tags: ["sentence", "source-backed", ...input.tags],
    title: input.sentence.text.length > 74 ? `${input.sentence.text.slice(0, 71)}...` : input.sentence.text,
    tokenRange: {
      source_id: input.source.id,
      start_token: input.sentence.tokenStart,
      end_token: input.sentence.tokenEnd,
      text: input.sentence.text,
    },
    type: "sentence",
  });

  input.nodes.push(sentenceNode);
  input.relations.push(
    createContainsRelation({
      from: input.paragraphNodeId,
      id: `rel-${input.slug}-paragraph-sentence-${paragraphOrdinal}-${sentenceOrdinal}-${input.stamp}`,
      scoutBacked: input.scoutBacked,
      to: sentenceNodeId,
    }),
  );

  const phraseNodes = input.sentence.phrases.slice(0, input.materialization.phraseLimitPerSentence).map((phrase, phraseIndex) =>
    appendPhraseTerrain({
      ...input,
      phrase,
      phraseIndex,
      sentenceNodeId,
    }),
  );

  sentenceNode.child_ids = phraseNodes.map((node) => node.id);
  sentenceNode.child_layer_id = phraseNodes.length > 0 ? "L7" : undefined;
  sentenceNode.zoom_target = phraseNodes[0] ? { layer: "L7", node_id: phraseNodes[0].id } : undefined;

  return sentenceNode;
}

function appendPhraseTerrain(input: {
  anchor: { x: number; y: number };
  createdAt: string;
  createdFrom?: CreatedFromRef;
  nodes: TerrainNode[];
  paragraphIndex: number;
  phrase: PhraseGrain;
  phraseIndex: number;
  relations: TerrainRelation[];
  scoutBacked: boolean;
  sentenceIndex: number;
  sentenceNodeId: string;
  slug: string;
  source: SourceRef;
  stamp: string;
  tags: string[];
  materialization: TextMaterializationProfile;
}): TerrainNode {
  const paragraphOrdinal = input.paragraphIndex + 1;
  const sentenceOrdinal = input.sentenceIndex + 1;
  const phraseOrdinal = input.phraseIndex + 1;
  const phraseNodeId = `node-${input.slug}-phrase-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${input.stamp}`;
  const phraseNode = createSourceNode({
    canCreateSeed: true,
    createdAt: input.createdAt,
    createdFrom: input.createdFrom,
    id: phraseNodeId,
    layer: "L7",
    parentId: input.sentenceNodeId,
    position: {
      x: input.anchor.x + 1780,
      y: input.anchor.y - 180 + input.paragraphIndex * 150 + input.sentenceIndex * 74 + input.phraseIndex * 42,
    },
    source: input.source,
    sourceRange: {
      source_id: input.source.id,
      locator: `${input.source.id}#phrase-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}`,
      start: input.phrase.start,
      end: input.phrase.end,
      excerpt: input.phrase.text,
    },
    summary: input.phrase.text,
    tags: ["phrase", "source-backed", "seedable", ...input.tags],
    title: input.phrase.text,
    tokenRange: {
      source_id: input.source.id,
      start_token: input.phrase.tokenStart,
      end_token: input.phrase.tokenEnd,
      text: input.phrase.text,
    },
    type: "phrase",
  });

  input.nodes.push(phraseNode);
  input.relations.push(
    createContainsRelation({
      from: input.sentenceNodeId,
      id: `rel-${input.slug}-sentence-phrase-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${input.stamp}`,
      scoutBacked: input.scoutBacked,
      to: phraseNodeId,
    }),
  );

  const wordNodes = input.phrase.words.slice(0, input.materialization.wordLimitPerPhrase).map((word, wordIndex) =>
    appendWordTerrain({
      ...input,
      phraseNodeId,
      word,
      wordIndex,
    }),
  );

  phraseNode.child_ids = wordNodes.map((node) => node.id);
  phraseNode.child_layer_id = wordNodes.length > 0 ? "L8" : undefined;
  phraseNode.zoom_target = wordNodes[0] ? { layer: "L8", node_id: wordNodes[0].id } : undefined;

  return phraseNode;
}

function appendWordTerrain(input: {
  anchor: { x: number; y: number };
  createdAt: string;
  createdFrom?: CreatedFromRef;
  nodes: TerrainNode[];
  paragraphIndex: number;
  phraseIndex: number;
  phraseNodeId: string;
  relations: TerrainRelation[];
  scoutBacked: boolean;
  sentenceIndex: number;
  slug: string;
  source: SourceRef;
  stamp: string;
  tags: string[];
  word: WordGrain;
  wordIndex: number;
  materialization: TextMaterializationProfile;
}): TerrainNode {
  const paragraphOrdinal = input.paragraphIndex + 1;
  const sentenceOrdinal = input.sentenceIndex + 1;
  const phraseOrdinal = input.phraseIndex + 1;
  const wordOrdinal = input.wordIndex + 1;
  const wordNode = createSourceNode({
    canCreateSeed: true,
    createdAt: input.createdAt,
    createdFrom: input.createdFrom,
    id: `node-${input.slug}-word-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${input.stamp}`,
    layer: "L8",
    parentId: input.phraseNodeId,
    position: {
      x: input.anchor.x + 2110 + input.wordIndex * 118,
      y: input.anchor.y - 190 + input.paragraphIndex * 150 + input.sentenceIndex * 74 + input.phraseIndex * 42,
    },
    source: input.source,
    sourceRange: {
      source_id: input.source.id,
      locator: `${input.source.id}#word-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}`,
      start: input.word.start,
      end: input.word.end,
      excerpt: input.word.text,
    },
    summary: `Word grain from ${input.source.title}.`,
    tags: ["word", "source-backed", "seedable", ...input.tags],
    title: input.word.text,
    tokenRange: {
      source_id: input.source.id,
      start_token: input.word.tokenIndex,
      end_token: input.word.tokenIndex,
      text: input.word.text,
    },
    type: "word",
  });

  input.nodes.push(wordNode);
  input.relations.push(
    createContainsRelation({
      from: input.phraseNodeId,
      id: `rel-${input.slug}-phrase-word-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${input.stamp}`,
      scoutBacked: input.scoutBacked,
      to: wordNode.id,
    }),
  );

  return wordNode;
}

function createSourceNode(input: {
  canCreateSeed?: boolean;
  createdAt: string;
  createdFrom?: CreatedFromRef;
  id: string;
  layer: TerrainNode["layer"];
  parentId?: string;
  position: { x: number; y: number };
  source: SourceRef;
  sourceRange: NonNullable<TerrainNode["source_range"]>;
  summary: string;
  tags: string[];
  title: string;
  tokenRange?: TerrainNode["token_range"];
  type: TerrainNode["type"];
}): TerrainNode {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    layer: input.layer,
    source_state: "source_backed",
    confidence: 0.84,
    importance: input.layer === "L3" ? 0.78 : 0.62,
    tags: input.tags,
    summary: input.summary,
    source_id: input.source.id,
    source_url: input.source.url,
    source_title: input.source.title,
    source_type: input.source.source_type,
    retrieved_at: input.createdAt,
    parent_id: input.parentId,
    semantic_breadcrumb: [input.source.title, input.layer, input.title],
    quote: input.sourceRange.excerpt,
    source_range: input.sourceRange,
    token_range: input.tokenRange,
    can_create_seed: input.canCreateSeed,
    created_from: input.createdFrom,
    position_hint: input.position,
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function createContainsRelation(input: { from: string; id: string; scoutBacked: boolean; to: string }): TerrainRelation {
  return {
    id: input.id,
    from: input.from,
    to: input.to,
    type: "source_contains",
    confidence: 0.88,
    explanation: input.scoutBacked
      ? "User-confirmed Scout observation created this source-backed text-grain relation."
      : "Manual source ingestion created this source-backed text-grain relation.",
    source_state: "source_backed",
  };
}

function getSourceAnchor(scene: TerrainScene): { x: number; y: number } {
  const existingSourceNodes = scene.nodes.filter((node) => node.type === "source" || node.source_state === "source_backed");
  const offset = existingSourceNodes.length * 130;

  return {
    x: scene.viewport.x + 360,
    y: scene.viewport.y - 160 + offset,
  };
}

const DEFAULT_TEXT_MATERIALIZATION: TextMaterializationProfile = {
  paragraphLimit: 12,
  sentenceLimitPerParagraph: 4,
  phraseLimitPerSentence: 3,
  wordLimitPerPhrase: 6,
  wordsPerSentenceScanLimit: 48,
  phraseWordScanLimit: 12,
};

const TEXT_GRAIN_MATERIALIZATION: TextMaterializationProfile = {
  paragraphLimit: 18,
  sentenceLimitPerParagraph: 6,
  phraseLimitPerSentence: 4,
  wordLimitPerPhrase: 8,
  wordsPerSentenceScanLimit: 72,
  phraseWordScanLimit: 18,
};

function resolveTextMaterializationProfile(input: SourceIngestionInput): TextMaterializationProfile {
  const base =
    input.initialLayer === "L5" ||
    input.initialLayer === "L6" ||
    input.initialLayer === "L7" ||
    input.initialLayer === "L8" ||
    input.initialLayer === "L9" ||
    input.initialLayer === "L10"
      ? TEXT_GRAIN_MATERIALIZATION
      : DEFAULT_TEXT_MATERIALIZATION;

  const profile = {
    ...base,
    ...input.materialization,
  };

  return {
    paragraphLimit: clampMaterializationLimit(profile.paragraphLimit, 1, 80),
    sentenceLimitPerParagraph: clampMaterializationLimit(profile.sentenceLimitPerParagraph, 1, 18),
    phraseLimitPerSentence: clampMaterializationLimit(profile.phraseLimitPerSentence, 1, 12),
    wordLimitPerPhrase: clampMaterializationLimit(profile.wordLimitPerPhrase, 1, 20),
    wordsPerSentenceScanLimit: clampMaterializationLimit(profile.wordsPerSentenceScanLimit, 8, 180),
    phraseWordScanLimit: clampMaterializationLimit(profile.phraseWordScanLimit, 4, 60),
  };
}

function clampMaterializationLimit(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function createTextTerrain(body: string, materialization: TextMaterializationProfile): TextTerrain {
  let tokenCursor = 0;
  const paragraphMatches = [...body.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)];
  const paragraphs = paragraphMatches
    .map<ParagraphGrain>((match) => {
      const rawText = match[0];
      const start = match.index ?? 0;
      const text = rawText.trim().replace(/\s+/g, " ");
      const sentenceMatches = [...text.matchAll(/[^.!?。！？]+[.!?。！？]?/g)].filter((sentenceMatch) => sentenceMatch[0].trim().length > 0);
      const paragraphTokenStart = tokenCursor;
      const sentences = sentenceMatches.map<SentenceGrain>((sentenceMatch) => {
        const sentenceText = sentenceMatch[0].trim();
        const sentenceStart = start + (sentenceMatch.index ?? 0);
        const words = createWordGrains(sentenceText, sentenceStart, tokenCursor, materialization.wordsPerSentenceScanLimit);
        const sentenceTokenStart = tokenCursor;
        tokenCursor += words.length;
        const phrases = createPhraseGrains(words, sentenceText, sentenceStart, materialization);

        return {
          start: sentenceStart,
          end: sentenceStart + sentenceText.length,
          text: sentenceText,
          tokenStart: sentenceTokenStart,
          tokenEnd: Math.max(sentenceTokenStart, tokenCursor - 1),
          phrases,
        };
      });

      return {
        start,
        end: start + rawText.length,
        text,
        tokenStart: paragraphTokenStart,
        tokenEnd: Math.max(paragraphTokenStart, tokenCursor - 1),
        sentences,
      };
    })
    .filter((paragraph) => paragraph.text.length > 0);

  if (paragraphs.length > 0) {
    return { paragraphs };
  }

  const fallbackWords = createWordGrains(body, 0, 0, materialization.wordsPerSentenceScanLimit);

  return {
    paragraphs: [
      {
        start: 0,
        end: body.length,
        text: body,
        tokenStart: 0,
        tokenEnd: Math.max(0, fallbackWords.length - 1),
        sentences: [
          {
            start: 0,
            end: body.length,
            text: body,
            tokenStart: 0,
            tokenEnd: Math.max(0, fallbackWords.length - 1),
            phrases: createPhraseGrains(fallbackWords, body, 0, materialization),
          },
        ],
      },
    ],
  };
}

function createWordGrains(text: string, offset: number, tokenStart: number, limit: number): WordGrain[] {
  return [...text.matchAll(/[\p{L}\p{N}_-]+/gu)].slice(0, limit).map((match, index) => ({
    start: offset + (match.index ?? 0),
    end: offset + (match.index ?? 0) + match[0].length,
    text: match[0],
    tokenIndex: tokenStart + index,
  }));
}

function createPhraseGrains(
  words: WordGrain[],
  sentenceText: string,
  sentenceOffset: number,
  materialization: TextMaterializationProfile,
): PhraseGrain[] {
  if (words.length === 0) {
    return [];
  }

  const phraseWords = words.slice(0, Math.min(materialization.phraseWordScanLimit, words.length));
  const phraseSize = phraseWords.length >= 4 ? 3 : Math.min(2, phraseWords.length);
  const chunks: WordGrain[][] = [phraseWords.slice(0, phraseSize)];

  if (phraseWords.length > phraseSize) {
    chunks.push(phraseWords.slice(phraseSize, phraseSize * 2));
  }

  if (phraseWords.length > phraseSize * 2) {
    chunks.push(phraseWords.slice(phraseSize * 2, phraseSize * 3));
  }

  return chunks
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const text = sentenceText.slice(first.start - sentenceOffset, last.end - sentenceOffset);

      return {
        start: first.start,
        end: last.end,
        text,
        tokenStart: first.tokenIndex,
        tokenEnd: last.tokenIndex,
        words: chunk,
      };
    });
}

function createExcerptTitle(excerpt: string, index: number): string {
  const firstSentence = excerpt.match(/[^.!?。！？]+/)?.[0]?.trim();
  const title = firstSentence || `Source excerpt ${index + 1}`;

  return title.length > 52 ? `${title.slice(0, 49)}...` : title;
}

function createSectionTitle(title: string, body: string): string {
  const firstLine = body.split("\n").find((line) => line.trim().length > 0)?.trim();
  const candidate = firstLine && firstLine.length < 80 ? firstLine : title;

  return candidate.length > 58 ? `${candidate.slice(0, 55)}...` : candidate;
}

function normalizeBody(body: string): string {
  return body.trim().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  return normalized || "Untitled source";
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "source";
}
