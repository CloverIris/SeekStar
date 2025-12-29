import { StarPointDto } from './star-point.dto';
import { StarClusterDto } from './star-cluster.dto';

export class SearchResponseDto {
  searchId: string;
  query: string;
  starMapId: string;
  estimatedCount: number;
  stars: StarPointDto[];
  clusters: StarClusterDto[];
}
