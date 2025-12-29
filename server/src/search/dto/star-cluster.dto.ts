export class StarClusterDto {
  id: string;
  name: string;
  description: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  radius: number;
  color: string;
  opacity: number;
  starCount: number;
  starIds: string[];
  tags: string[];
  mainTopic: string;
  subTopics: string[];
  relatedClusters: {
    id: string;
    weight: number;
  }[];
  relevanceScore: number;
  qualityScore: number;
}
