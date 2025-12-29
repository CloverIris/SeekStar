// 从后端获取的星点数据类型
export interface StarPoint {
  id: string;
  title: string;
  url: string;
  source: string;
  content: string;
  summary?: string;
  author: string[];
  publishDate: string;
  tags: string[];
  position: { x: number; y: number; z: number };
  size: number;
  brightness: number;
  color: string;
  clusterId?: string;
  imageUrl?: string;
  relatedStars: { id: string; weight: number }[];
  relevanceScore: number;
  qualityScore: number;
}

// 星团数据类型
export interface StarCluster {
  id: string;
  name: string;
  description: string;
  position: { x: number; y: number; z: number };
  radius: number;
  color: string;
  opacity: number;
  starCount: number;
  starIds: string[];
  tags: string[];
  mainTopic: string;
  subTopics: string[];
  relatedClusters: { id: string; weight: number }[];
  relevanceScore: number;
  qualityScore: number;
}

// 搜索响应数据类型
export interface SearchResponse {
  searchId: string;
  query: string;
  starMapId: string;
  estimatedCount: number;
  stars: StarPoint[];
  clusters: StarCluster[];
}

// LOD星点类型
export interface LODStar {
  star: StarPoint;
  lod: number;
}
