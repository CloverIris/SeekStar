export class StarPointDto {
  id: string;
  title: string;
  url: string;
  source: string;
  content: string;
  author: string[];
  publishDate: Date;
  tags: string[];
  position: {
    x: number;
    y: number;
    z: number;
  };
  size: number;
  brightness: number;
  color: string;
  clusterId?: string;
  relatedStars: {
    id: string;
    weight: number;
  }[];
  relevanceScore: number;
  qualityScore: number;
}
