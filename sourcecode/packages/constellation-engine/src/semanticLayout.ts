import type { LayerId, SemanticFootprint, TerrainNode } from "@seekstar/core-schema";

export function deriveVisualMass(importance: number, coverage: number, relationCentrality: number): number {
  return clamp(0.5 * importance + 0.35 * coverage + 0.15 * relationCentrality, 0.15, 1);
}

export function deriveSemanticFootprint(layer: LayerId, visualMass: number): SemanticFootprint {
  const ranges = {
    L0: { minWidth: 160, maxWidth: 360, minHeight: 120, maxHeight: 270 },
    L1: { minWidth: 110, maxWidth: 250, minHeight: 84, maxHeight: 190 },
    L2: { minWidth: 160, maxWidth: 320, minHeight: 72, maxHeight: 144 },
    L3: { minWidth: 240, maxWidth: 420, minHeight: 152, maxHeight: 264 },
  }[layer];
  return {
    width: Math.round(lerp(ranges.minWidth, ranges.maxWidth, visualMass)),
    height: Math.round(lerp(ranges.minHeight, ranges.maxHeight, visualMass)),
  };
}

export function semanticCentroid(positions: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (positions.length === 0) return { x: 0, y: 0 };
  return {
    x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
    y: positions.reduce((sum, position) => sum + position.y, 0) / positions.length,
  };
}

export function settleSemanticPosition(node: TerrainNode, anchor: { x: number; y: number }, obstacles: TerrainNode[]): { x: number; y: number } {
  const footprint = node.footprint ?? { width: 180, height: 110 };
  const baseAngle = deterministicUnit(node.id) * Math.PI * 2;
  const baseRadius = node.layer === "L0" ? 280 : node.layer === "L1" ? 170 : 120;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = baseAngle + attempt * 2.399963;
    const radius = attempt === 0 ? baseRadius * 0.3 : baseRadius * (0.5 + attempt * 0.18);
    const candidate = { x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius };
    const overlaps = obstacles.some((other) => {
      if (other.layer !== node.layer || !other.position_hint) return false;
      const otherFootprint = other.footprint ?? { width: 180, height: 110 };
      return Math.abs(candidate.x - other.position_hint.x) < (footprint.width + otherFootprint.width) * 0.42 &&
        Math.abs(candidate.y - other.position_hint.y) < (footprint.height + otherFootprint.height) * 0.42;
    });
    if (!overlaps) return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
  }
  return { x: Math.round(anchor.x), y: Math.round(anchor.y) };
}

function deterministicUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function lerp(minimum: number, maximum: number, amount: number): number {
  return minimum + (maximum - minimum) * clamp(amount, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
