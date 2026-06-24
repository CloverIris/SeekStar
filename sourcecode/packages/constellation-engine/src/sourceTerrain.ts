import type { CreatedFromRef, LayerId, SourceRef, SourceType, TerrainNode, TerrainRelation, TerrainScene } from "@seekstar/core-schema";

export interface SourceIngestionInput {
  title: string;
  url?: string;
  body: string;
  sourceType?: SourceType;
  retrievedAt?: string;
  reliabilityHints?: string[];
  tags?: string[];
  createdFrom?: CreatedFromRef;
  observationId?: string;
  initialLayer?: LayerId;
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

interface HeuristicCandidateGrain {
  count: number;
  end: number;
  score: number;
  start: number;
  text: string;
  tokenEnd: number;
  tokenStart: number;
}

interface CharacterGrain {
  end: number;
  start: number;
  text: string;
  tokenIndex: number;
}

let sourceCounter = 0;

export function createSourceTerrainPatch(input: SourceIngestionInput, scene: TerrainScene): SourceTerrainPatch {
  sourceCounter += 1;

  const createdAt = input.retrievedAt ?? new Date().toISOString();
  const title = normalizeTitle(input.title);
  const sourceText = normalizeBody(input.body);
  const textTerrain = createTextTerrain(sourceText);
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
    url: input.url?.trim() || undefined,
    source_type: input.sourceType ?? (input.url?.trim() ? "webpage" : "document"),
    retrieved_at: createdAt,
    snippet: textTerrain.paragraphs[0]?.text ?? sourceText.slice(0, 220),
    reliability_hints: input.reliabilityHints ?? ["manual user-provided source", "not retrieved by Playwright"],
    created_from_observation_id: input.observationId,
  };

  const sourceNode: TerrainNode = {
    id: sourceNodeId,
    type: "source",
    title,
    layer: "L2",
    source_state: "source_backed",
    confidence: 0.86,
    importance: 0.88,
    tags: ["source", "source-backed", "p5-3-text-terrain", ...tags],
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
    tags: ["document-tile", "source-backed", "p5-3-text-terrain", ...tags],
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
    tags: ["section", "source-backed", "p5-3-text-terrain", ...tags],
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

  const paragraphNodes = textTerrain.paragraphs.slice(0, 4).map((paragraph, paragraphIndex) =>
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
    }),
  );
  const heuristicCandidateNodes = createHeuristicCandidates(textTerrain)
    .slice(0, 8)
    .map((candidate, index) =>
      createHeuristicCandidateNode({
        anchor,
        candidate,
        createdAt,
        createdFrom: input.createdFrom,
        id: `node-${slug}-heuristic-candidate-${index + 1}-${stamp}`,
        index,
        source,
        sourceNodeId,
        tags,
      }),
    );

  documentNode.child_ids = [sectionNodeId];
  documentNode.child_layer_id = "L4";
  documentNode.zoom_target = { layer: "L4", node_id: sectionNodeId };
  sectionNode.child_ids = paragraphNodes.map((node) => node.id);
  sectionNode.child_layer_id = "L5";
  sectionNode.zoom_target = paragraphNodes[0] ? { layer: "L5", node_id: paragraphNodes[0].id } : undefined;
  nodes.push(...heuristicCandidateNodes);
  relations.push(
    ...heuristicCandidateNodes.map((candidateNode, index) =>
      createHeuristicCandidateRelation({
        from: sourceNodeId,
        id: `rel-${slug}-source-heuristic-candidate-${index + 1}-${stamp}`,
        to: candidateNode.id,
      }),
    ),
  );

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
    tags: ["paragraph", "source-backed", "p5-3-text-terrain", ...input.tags],
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

  const sentenceNodes = input.paragraph.sentences.slice(0, 2).map((sentence, sentenceIndex) =>
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
    tags: ["sentence", "source-backed", "p5-3-text-terrain", ...input.tags],
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

  const phraseNodes = input.sentence.phrases.slice(0, 2).map((phrase, phraseIndex) =>
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
    tags: ["phrase", "source-backed", "seedable", "p5-3-text-terrain", ...input.tags],
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

  const wordNodes = input.phrase.words.slice(0, 3).map((word, wordIndex) =>
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
    tags: ["word", "source-backed", "seedable", "p5-3-text-terrain", ...input.tags],
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

  const characterNodes = createCharacterGrains(input.word).slice(0, 2).map((character, characterIndex) =>
    appendCharacterTerrain({
      ...input,
      character,
      characterIndex,
      wordNodeId: wordNode.id,
    }),
  );

  wordNode.child_ids = characterNodes.map((node) => node.id);
  wordNode.child_layer_id = characterNodes.length > 0 ? "L9" : undefined;
  wordNode.zoom_target = characterNodes[0] ? { layer: "L9", node_id: characterNodes[0].id } : undefined;

  return wordNode;
}

function appendCharacterTerrain(input: {
  anchor: { x: number; y: number };
  character: CharacterGrain;
  characterIndex: number;
  createdAt: string;
  createdFrom?: CreatedFromRef;
  nodes: TerrainNode[];
  paragraphIndex: number;
  phraseIndex: number;
  relations: TerrainRelation[];
  scoutBacked: boolean;
  sentenceIndex: number;
  slug: string;
  source: SourceRef;
  stamp: string;
  tags: string[];
  word: WordGrain;
  wordIndex: number;
  wordNodeId: string;
}): TerrainNode {
  const paragraphOrdinal = input.paragraphIndex + 1;
  const sentenceOrdinal = input.sentenceIndex + 1;
  const phraseOrdinal = input.phraseIndex + 1;
  const wordOrdinal = input.wordIndex + 1;
  const characterOrdinal = input.characterIndex + 1;
  const characterNodeId = `node-${input.slug}-character-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${characterOrdinal}-${input.stamp}`;
  const unicodeNodeId = `node-${input.slug}-unicode-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${characterOrdinal}-${input.stamp}`;
  const seedLoopNodeId = `node-${input.slug}-seed-loop-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${characterOrdinal}-${input.stamp}`;
  const characterNode = createSourceNode({
    canCreateSeed: true,
    createdAt: input.createdAt,
    createdFrom: input.createdFrom,
    id: characterNodeId,
    layer: "L9",
    parentId: input.wordNodeId,
    position: {
      x: input.anchor.x + 2480 + input.characterIndex * 96,
      y: input.anchor.y - 196 + input.paragraphIndex * 150 + input.sentenceIndex * 74 + input.phraseIndex * 42 + input.wordIndex * 30,
    },
    source: input.source,
    sourceRange: {
      source_id: input.source.id,
      locator: `${input.source.id}#character-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${characterOrdinal}`,
      start: input.character.start,
      end: input.character.end,
      excerpt: input.character.text,
    },
    summary: `Character grain from the word "${input.word.text}".`,
    tags: ["character", "source-backed", "seedable", "p5-4-character-terrain", ...input.tags],
    title: input.character.text,
    tokenRange: {
      source_id: input.source.id,
      start_token: input.word.tokenIndex,
      end_token: input.word.tokenIndex,
      text: input.character.text,
    },
    type: "character",
  });
  const unicodeNode = createUnicodeNode({
    character: input.character,
    characterNodeId,
    createdAt: input.createdAt,
    createdFrom: input.createdFrom,
    id: unicodeNodeId,
    position: {
      x: input.anchor.x + 2760 + input.characterIndex * 112,
      y: input.anchor.y - 196 + input.paragraphIndex * 150 + input.sentenceIndex * 74 + input.phraseIndex * 42 + input.wordIndex * 30,
    },
    source: input.source,
    tags: input.tags,
  });
  const seedLoopNode = createRecursiveSeedNode({
    character: input.character,
    createdAt: input.createdAt,
    createdFrom: input.createdFrom,
    id: seedLoopNodeId,
    parentId: unicodeNodeId,
    position: {
      x: input.anchor.x + 3040 + input.characterIndex * 126,
      y: input.anchor.y - 196 + input.paragraphIndex * 150 + input.sentenceIndex * 74 + input.phraseIndex * 42 + input.wordIndex * 30,
    },
    source: input.source,
    tags: input.tags,
    word: input.word,
  });

  characterNode.child_ids = [unicodeNodeId];
  characterNode.child_layer_id = "L10";
  characterNode.zoom_target = { layer: "L10", node_id: unicodeNodeId };
  unicodeNode.child_ids = [seedLoopNodeId];
  unicodeNode.child_layer_id = "L11";
  unicodeNode.zoom_target = { layer: "L11", node_id: seedLoopNodeId };
  input.nodes.push(characterNode, unicodeNode, seedLoopNode);
  input.relations.push(
    createContainsRelation({
      from: input.wordNodeId,
      id: `rel-${input.slug}-word-character-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${characterOrdinal}-${input.stamp}`,
      scoutBacked: input.scoutBacked,
      to: characterNodeId,
    }),
    createTokenRelation({
      from: characterNodeId,
      id: `rel-${input.slug}-character-unicode-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${characterOrdinal}-${input.stamp}`,
      to: unicodeNodeId,
    }),
    createRecursiveSeedRelation({
      from: unicodeNodeId,
      id: `rel-${input.slug}-unicode-seed-loop-${paragraphOrdinal}-${sentenceOrdinal}-${phraseOrdinal}-${wordOrdinal}-${characterOrdinal}-${input.stamp}`,
      to: seedLoopNodeId,
    }),
  );

  return characterNode;
}

function createUnicodeNode(input: {
  character: CharacterGrain;
  characterNodeId: string;
  createdAt: string;
  createdFrom?: CreatedFromRef;
  id: string;
  position: { x: number; y: number };
  source: SourceRef;
  tags: string[];
}): TerrainNode {
  const codePoint = input.character.text.codePointAt(0) ?? 0;
  const codePointLabel = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;

  return {
    id: input.id,
    type: "dictionary_entry",
    title: `${codePointLabel} ${input.character.text}`,
    layer: "L10",
    source_state: "local_only",
    confidence: 0.74,
    importance: 0.48,
    tags: ["unicode", "dictionary", "seedable", "local-derived", "p5-4-character-terrain", ...input.tags],
    summary: `Local Unicode card for "${input.character.text}". It is derived from the source character, not retrieved from an external dictionary.`,
    source_id: input.source.id,
    source_url: input.source.url,
    source_title: input.source.title,
    source_type: "dictionary",
    retrieved_at: input.createdAt,
    parent_id: input.characterNodeId,
    semantic_breadcrumb: [input.source.title, "Unicode / 字典", codePointLabel],
    quote: input.character.text,
    source_range: {
      source_id: input.source.id,
      locator: `${input.source.id}#unicode-${codePointLabel}`,
      start: input.character.start,
      end: input.character.end,
      excerpt: input.character.text,
    },
    token_range: {
      source_id: input.source.id,
      start_token: input.character.tokenIndex,
      end_token: input.character.tokenIndex,
      text: input.character.text,
    },
    can_create_seed: true,
    created_from: input.createdFrom,
    position_hint: input.position,
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function createRecursiveSeedNode(input: {
  character: CharacterGrain;
  createdAt: string;
  createdFrom?: CreatedFromRef;
  id: string;
  parentId: string;
  position: { x: number; y: number };
  source: SourceRef;
  tags: string[];
  word: WordGrain;
}): TerrainNode {
  const seedText = input.character.text || input.word.text;

  return {
    id: input.id,
    type: "question",
    title: `Explore ${seedText} as seed`,
    layer: "L11",
    source_state: "local_only",
    confidence: 0.68,
    importance: 0.56,
    tags: ["recursive-seed", "seedable", "source-grain", "p5-12level-spine", ...input.tags],
    summary: `Recursive seed entry for "${seedText}" from ${input.source.title}. It can open a new independent 12Level SeekStar tab.`,
    source_id: input.source.id,
    source_url: input.source.url,
    source_title: input.source.title,
    source_type: input.source.source_type,
    retrieved_at: input.createdAt,
    parent_id: input.parentId,
    semantic_breadcrumb: [input.source.title, "新的探索 seed", seedText],
    quote: seedText,
    source_range: {
      source_id: input.source.id,
      locator: `${input.source.id}#recursive-seed-${seedText}`,
      start: input.character.start,
      end: input.character.end,
      excerpt: seedText,
    },
    token_range: {
      source_id: input.source.id,
      start_token: input.character.tokenIndex,
      end_token: input.character.tokenIndex,
      text: seedText,
    },
    can_create_seed: true,
    created_from: input.createdFrom,
    position_hint: input.position,
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
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

function createTokenRelation(input: { from: string; id: string; to: string }): TerrainRelation {
  return {
    id: input.id,
    from: input.from,
    to: input.to,
    type: "token_contains",
    confidence: 0.76,
    explanation: "Local deterministic Unicode expansion from a source-backed character grain.",
    source_state: "local_only",
  };
}

function createRecursiveSeedRelation(input: { from: string; id: string; to: string }): TerrainRelation {
  return {
    id: input.id,
    from: input.from,
    to: input.to,
    type: "parent_child",
    confidence: 0.68,
    explanation: "Local deterministic recursive-seed affordance from a source-backed text grain.",
    source_state: "local_only",
  };
}

function createHeuristicCandidateRelation(input: { from: string; id: string; to: string }): TerrainRelation {
  return {
    id: input.id,
    from: input.from,
    to: input.to,
    type: "semantic_similarity",
    confidence: 0.52,
    explanation: "Local heuristic candidate derived from repeated or salient source text. It is a seed suggestion, not an AI claim.",
    source_state: "local_only",
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

function createTextTerrain(body: string): TextTerrain {
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
        const words = createWordGrains(sentenceText, sentenceStart, tokenCursor);
        const sentenceTokenStart = tokenCursor;
        tokenCursor += words.length;
        const phrases = createPhraseGrains(words, sentenceText, sentenceStart);

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

  const fallbackWords = createWordGrains(body, 0, 0);

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
            phrases: createPhraseGrains(fallbackWords, body, 0),
          },
        ],
      },
    ],
  };
}

function createHeuristicCandidateNode(input: {
  anchor: { x: number; y: number };
  candidate: HeuristicCandidateGrain;
  createdAt: string;
  createdFrom?: CreatedFromRef;
  id: string;
  index: number;
  source: SourceRef;
  sourceNodeId: string;
  tags: string[];
}): TerrainNode {
  const angle = -Math.PI / 2 + input.index * 0.58;
  const radius = 360 + Math.floor(input.index / 5) * 110;

  return {
    id: input.id,
    type: "concept",
    title: input.candidate.text,
    layer: "L1",
    source_state: "local_only",
    confidence: Math.min(0.72, 0.38 + input.candidate.score / 18),
    importance: Math.min(0.82, 0.42 + input.candidate.score / 16),
    tags: ["heuristic-candidate", "seedable", "local-derived", "p5-5-candidate-pool", ...input.tags],
    summary: `Local candidate seed from ${input.source.title}. It appears ${input.candidate.count} time${input.candidate.count === 1 ? "" : "s"} in the source text.`,
    source_id: input.source.id,
    source_url: input.source.url,
    source_title: input.source.title,
    source_type: input.source.source_type,
    retrieved_at: input.createdAt,
    parent_id: input.sourceNodeId,
    semantic_breadcrumb: [input.source.title, "Heuristic candidates", input.candidate.text],
    quote: input.candidate.text,
    source_range: {
      source_id: input.source.id,
      locator: `${input.source.id}#heuristic-candidate-${input.index + 1}`,
      start: input.candidate.start,
      end: input.candidate.end,
      excerpt: input.candidate.text,
    },
    token_range: {
      source_id: input.source.id,
      start_token: input.candidate.tokenStart,
      end_token: input.candidate.tokenEnd,
      text: input.candidate.text,
    },
    can_create_seed: true,
    created_from: input.createdFrom,
    position_hint: {
      x: input.anchor.x + Math.cos(angle) * radius,
      y: input.anchor.y + Math.sin(angle) * radius,
    },
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function createHeuristicCandidates(textTerrain: TextTerrain): HeuristicCandidateGrain[] {
  const candidatesByKey = new Map<string, HeuristicCandidateGrain>();

  for (const paragraph of textTerrain.paragraphs) {
    for (const sentence of paragraph.sentences) {
      for (const phrase of sentence.phrases) {
        collectCandidate(candidatesByKey, phrase.text, phrase.start, phrase.end, phrase.tokenStart, phrase.tokenEnd, 1.35);
      }

      for (const word of sentence.phrases.flatMap((phrase) => phrase.words)) {
        collectCandidate(candidatesByKey, word.text, word.start, word.end, word.tokenIndex, word.tokenIndex, 1);
      }
    }
  }

  return [...candidatesByKey.values()]
    .map((candidate) => ({
      ...candidate,
      score: candidate.score + Math.min(4, candidate.count) * 1.6 + Math.min(3, candidate.text.length / 7),
    }))
    .sort((left, right) => right.score - left.score || left.start - right.start);
}

function collectCandidate(
  candidatesByKey: Map<string, HeuristicCandidateGrain>,
  rawText: string,
  start: number,
  end: number,
  tokenStart: number,
  tokenEnd: number,
  baseScore: number,
): void {
  const text = normalizeCandidateText(rawText);
  const key = text.toLocaleLowerCase();

  if (!isUsefulCandidate(text)) {
    return;
  }

  const current = candidatesByKey.get(key);

  if (current) {
    current.count += 1;
    current.score += baseScore;
    return;
  }

  candidatesByKey.set(key, {
    count: 1,
    end,
    score: baseScore,
    start,
    text,
    tokenEnd,
    tokenStart,
  });
}

function createWordGrains(text: string, offset: number, tokenStart: number): WordGrain[] {
  return [...text.matchAll(/[\p{L}\p{N}_-]+/gu)].slice(0, 24).map((match, index) => ({
    start: offset + (match.index ?? 0),
    end: offset + (match.index ?? 0) + match[0].length,
    text: match[0],
    tokenIndex: tokenStart + index,
  }));
}

function createPhraseGrains(words: WordGrain[], sentenceText: string, sentenceOffset: number): PhraseGrain[] {
  if (words.length === 0) {
    return [];
  }

  const phraseWords = words.slice(0, Math.min(6, words.length));
  const phraseSize = phraseWords.length >= 4 ? 3 : Math.min(2, phraseWords.length);
  const chunks: WordGrain[][] = [phraseWords.slice(0, phraseSize)];

  if (phraseWords.length > phraseSize) {
    chunks.push(phraseWords.slice(phraseSize, phraseSize * 2));
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

function createCharacterGrains(word: WordGrain): CharacterGrain[] {
  let offset = 0;

  return Array.from(word.text).map((character) => {
    const start = word.start + offset;
    offset += character.length;

    return {
      start,
      end: start + character.length,
      text: character,
      tokenIndex: word.tokenIndex,
    };
  });
}

function normalizeCandidateText(rawText: string): string {
  return rawText
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ");
}

function isUsefulCandidate(text: string): boolean {
  const lower = text.toLocaleLowerCase();

  if (text.length < 4 || text.length > 42) {
    return false;
  }

  if (/^\d+$/.test(text)) {
    return false;
  }

  if (STOP_WORDS.has(lower)) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(text);
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

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "between",
  "could",
  "from",
  "have",
  "into",
  "more",
  "only",
  "other",
  "over",
  "should",
  "source",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "when",
  "where",
  "which",
  "with",
  "would",
]);
