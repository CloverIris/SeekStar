import { SearchService } from './search.service';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchResponseDto } from './dto/search-response.dto';
export declare class SearchController {
    private readonly searchService;
    constructor(searchService: SearchService);
    search(request: SearchRequestDto): Promise<SearchResponseDto>;
    getSuggestions(query: string, limit?: string): Promise<{
        query: string;
        suggestions: {
            text: string;
            type: string;
            score: number;
        }[];
    }>;
}
