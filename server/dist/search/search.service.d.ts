import { SearchRequestDto } from './dto/search-request.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { DagService } from '../dag/dag.service';
export declare class SearchService {
    private readonly dagService;
    private readonly aiServiceUrl;
    constructor(dagService: DagService);
    search(request: SearchRequestDto): Promise<SearchResponseDto>;
    private enhanceStarRelations;
    private createSimilarityRelations;
    private calculateTextSimilarity;
    private generateStarMap;
    private fetchRealSearchResults;
    private generateAdditionalResults;
    private generateIntelligentResults;
    private mapToStarPoints;
    private mapToStarClusters;
    private generateMockStarMap;
    private calculateRelevanceScore;
    private calculateQualityScore;
    private calculateColorFromTags;
    private getColorFromClusterCenter;
    private getRandomColor;
}
