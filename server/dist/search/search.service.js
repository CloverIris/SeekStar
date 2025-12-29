"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const cheerio = __importStar(require("cheerio"));
const dag_service_1 = require("../dag/dag.service");
let SearchService = class SearchService {
    dagService;
    aiServiceUrl;
    constructor(dagService) {
        this.dagService = dagService;
        this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    }
    async search(request) {
        try {
            const dagResult = await this.dagService.executeDagSearch(request.query);
            const searchResults = await this.fetchRealSearchResults(request.query, request.limit || 100);
            const texts = searchResults.map(result => result.title + ' ' + result.content);
            let starMapResponse;
            try {
                starMapResponse = await this.generateStarMap(texts);
            }
            catch (aiError) {
                console.warn('AI service unavailable, using mock star map data:', aiError.message);
                starMapResponse = this.generateMockStarMap(searchResults.length);
            }
            const searchId = (0, uuid_1.v4)();
            const starMapId = (0, uuid_1.v4)();
            const uniqueSearchResults = searchResults.filter((result, index, self) => index === self.findIndex((s) => s.url === result.url));
            const adjustedCoordinates = starMapResponse.coordinates.slice(0, uniqueSearchResults.length);
            const adjustedEmbeddings = starMapResponse.embeddings.slice(0, uniqueSearchResults.length);
            const adjustedClusterLabels = starMapResponse.clustering.labels.slice(0, uniqueSearchResults.length);
            const stars = this.mapToStarPoints(uniqueSearchResults, adjustedCoordinates, adjustedEmbeddings, adjustedClusterLabels);
            const clusters = this.mapToStarClusters(starMapResponse.clustering);
            this.enhanceStarRelations(stars, clusters, dagResult);
            return {
                searchId,
                query: request.query,
                starMapId,
                estimatedCount: searchResults.length,
                stars,
                clusters
            };
        }
        catch (error) {
            console.error('Search service error:', error);
            throw new common_1.HttpException('Failed to perform search', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    enhanceStarRelations(stars, clusters, dagResult) {
        if (dagResult.data.clusters) {
            dagResult.data.clusters.forEach((cluster) => {
                if (cluster.members && cluster.members.length > 1) {
                    for (let i = 0; i < cluster.members.length; i++) {
                        for (let j = i + 1; j < cluster.members.length; j++) {
                            const star1 = stars[parseInt(cluster.members[i])];
                            const star2 = stars[parseInt(cluster.members[j])];
                            if (star1 && star2) {
                                star1.relatedStars.push({ id: star2.id, weight: 0.8 });
                                star2.relatedStars.push({ id: star1.id, weight: 0.8 });
                            }
                        }
                    }
                }
            });
        }
        if (dagResult.data.aiResults?.relations) {
            dagResult.data.aiResults.relations.forEach((relation) => {
                const relatedStars = stars.filter(star => star.title.includes(relation[0]) || star.title.includes(relation[2]) ||
                    star.content.includes(relation[0]) || star.content.includes(relation[2]));
                for (let i = 0; i < relatedStars.length; i++) {
                    for (let j = i + 1; j < relatedStars.length; j++) {
                        relatedStars[i].relatedStars.push({ id: relatedStars[j].id, weight: 0.7 });
                        relatedStars[j].relatedStars.push({ id: relatedStars[i].id, weight: 0.7 });
                    }
                }
            });
        }
        this.createSimilarityRelations(stars);
    }
    createSimilarityRelations(stars) {
        for (let i = 0; i < stars.length; i++) {
            for (let j = i + 1; j < stars.length; j++) {
                const star1 = stars[i];
                const star2 = stars[j];
                const titleSimilarity = this.calculateTextSimilarity(star1.title, star2.title);
                const commonTags = star1.tags.filter(tag => star2.tags.includes(tag));
                const tagSimilarity = commonTags.length / Math.max(star1.tags.length, star2.tags.length);
                const similarity = (titleSimilarity + tagSimilarity) / 2;
                if (similarity > 0.3) {
                    star1.relatedStars.push({ id: star2.id, weight: similarity });
                    star2.relatedStars.push({ id: star1.id, weight: similarity });
                }
            }
        }
    }
    calculateTextSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        const commonWords = Array.from(words1).filter(word => words2.has(word));
        const totalWords = new Set([...words1, ...words2]);
        return commonWords.length / totalWords.size;
    }
    async generateStarMap(texts) {
        try {
            const response = await axios_1.default.post(`${this.aiServiceUrl}/api/v1/starmap/generate`, {
                texts,
                n_neighbors: 15,
                min_dist: 0.1,
                min_cluster_size: 5
            });
            return response.data;
        }
        catch (error) {
            console.error('AI service error:', error);
            throw new common_1.HttpException('Failed to generate star map', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async fetchRealSearchResults(query, limit) {
        try {
            const response = await axios_1.default.get('https://www.bing.com/search', {
                params: {
                    q: query,
                    count: limit * 2
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const $ = cheerio.load(response.data);
            const results = [];
            const seenUrls = new Set();
            $('.b_algo').each((index, element) => {
                if (results.length >= limit)
                    return false;
                const titleElement = $(element).find('h2 a');
                const title = titleElement.text().trim();
                const url = titleElement.attr('href') || '';
                if (!url || seenUrls.has(url)) {
                    return;
                }
                seenUrls.add(url);
                const contentElement = $(element).find('.b_caption p');
                const content = contentElement.text().trim() || `关于"${query}"的搜索结果 - ${title}`;
                const sourceMatch = url.match(/https?:\/\/(www\.)?([^\/]+)/);
                const source = sourceMatch ? sourceMatch[2] : 'Unknown';
                const dateElement = $(element).find('.b_dates');
                let publishDate = new Date();
                if (dateElement.length > 0) {
                    const dateText = dateElement.text().trim();
                    if (dateText.includes('天前')) {
                        const daysAgo = parseInt(dateText.match(/(\d+)天前/)?.[1] || '0');
                        publishDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
                    }
                    else if (dateText.includes('周前')) {
                        const weeksAgo = parseInt(dateText.match(/(\d+)周前/)?.[1] || '0');
                        publishDate = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
                    }
                    else if (dateText.includes('月前')) {
                        const monthsAgo = parseInt(dateText.match(/(\d+)月前/)?.[1] || '0');
                        publishDate = new Date(Date.now() - monthsAgo * 30 * 24 * 60 * 60 * 1000);
                    }
                }
                const authorMatch = content.match(/作者：([^，。]+)/);
                const author = authorMatch ? [authorMatch[1]] : [source];
                const tags = [query, source.toLowerCase()];
                if (content.length > 50) {
                    const contentWords = content.split(/\s+/).filter(word => word.length > 2);
                    const topWords = contentWords.slice(0, 3).map(word => word.toLowerCase());
                    tags.push(...topWords);
                }
                if (title && url) {
                    results.push({
                        title,
                        url,
                        source,
                        content,
                        author,
                        publishDate,
                        tags: [...new Set(tags)]
                    });
                }
            });
            if (results.length < limit) {
                const additionalResults = this.generateAdditionalResults(query, limit - results.length, results);
                const additionalUniqueResults = additionalResults.filter(result => {
                    if (seenUrls.has(result.url)) {
                        return false;
                    }
                    seenUrls.add(result.url);
                    return true;
                });
                results.push(...additionalUniqueResults);
            }
            return results;
        }
        catch (error) {
            console.error('Error fetching real search results from Bing:', error);
            console.warn('Falling back to intelligent generated results');
            return this.generateIntelligentResults(query, limit);
        }
    }
    generateAdditionalResults(query, limit, existingResults) {
        const results = [];
        const existingTags = new Set();
        const existingAuthors = new Set();
        existingResults.forEach(result => {
            result.tags.forEach((tag) => existingTags.add(tag));
            result.author.forEach((author) => existingAuthors.add(author));
        });
        for (let i = 0; i < limit; i++) {
            const randomTags = Array.from(existingTags).slice(0, 3);
            const randomAuthor = Array.from(existingAuthors)[Math.floor(Math.random() * existingAuthors.size)] || 'Unknown Author';
            results.push({
                title: `${query} ${randomTags.join(' ')} - 补充结果 ${i + 1}`,
                url: `https://example.com/${query}-${randomTags.join('-')}-${i}`,
                source: 'generated',
                content: `这是关于"${query}"的补充信息，涵盖了${randomTags.join('、')}等相关主题。该内容基于现有搜索结果生成，用于丰富星图展示。`,
                author: [randomAuthor],
                publishDate: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000),
                tags: [...new Set([query, ...randomTags])]
            });
        }
        return results;
    }
    generateIntelligentResults(query, limit) {
        const results = [];
        const relatedTopics = [
            '介绍', '基础', '教程', '指南', '高级', '技术', '案例', '研究', '趋势', '应用',
            '原理', '实践', '工具', '资源', '社区', '生态', '发展', '挑战', '机遇'
        ];
        for (let i = 0; i < limit; i++) {
            const randomTopic = relatedTopics[Math.floor(Math.random() * relatedTopics.length)];
            const randomAuthor = `智能生成作者 ${i + 1}`;
            const randomDate = new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000);
            results.push({
                title: `${query} ${randomTopic}`,
                url: `https://generated.example.com/${query}-${randomTopic}-${i}`,
                source: 'intelligent-generated',
                content: `这是关于"${query}"的${randomTopic}信息。由于真实搜索暂时不可用，该内容是基于查询词智能生成的，用于提供星图展示所需的数据。`,
                author: [randomAuthor],
                publishDate: randomDate,
                tags: [query, randomTopic.toLowerCase(), 'generated']
            });
        }
        return results;
    }
    mapToStarPoints(searchResults, coordinates, embeddings, clusterLabels) {
        return searchResults.map((result, index) => {
            const coordinate = coordinates[index] || [0, 0, 0];
            const embedding = embeddings[index] || [];
            const relevanceScore = this.calculateRelevanceScore(result);
            const qualityScore = this.calculateQualityScore(result);
            const color = this.calculateColorFromTags(result.tags);
            return {
                id: (0, uuid_1.v4)(),
                title: result.title,
                url: result.url,
                source: result.source,
                content: result.content,
                author: result.author,
                publishDate: result.publishDate,
                tags: result.tags,
                position: {
                    x: coordinate[0],
                    y: coordinate[1],
                    z: coordinate[2]
                },
                size: relevanceScore * 2 + 0.5,
                brightness: qualityScore * 0.7 + 0.3,
                color: color,
                clusterId: clusterLabels[index] === -1 ? undefined : `cluster-${clusterLabels[index]}`,
                relatedStars: [],
                relevanceScore: relevanceScore,
                qualityScore: qualityScore
            };
        });
    }
    mapToStarClusters(clusteringResult) {
        const clusters = [];
        for (const [clusterId, clusterData] of Object.entries(clusteringResult.clusters)) {
            const color = this.getColorFromClusterCenter(clusterData.center);
            clusters.push({
                id: `cluster-${clusterId}`,
                name: `Cluster ${clusterId}`,
                description: `相关内容聚类，包含 ${clusterData.points.length} 个星点`,
                position: {
                    x: clusterData.center[0],
                    y: clusterData.center[1],
                    z: clusterData.center[2]
                },
                radius: Math.min(15, Math.max(5, clusterData.points.length / 10)),
                color: color,
                opacity: 0.6,
                starCount: clusterData.points.length,
                starIds: clusterData.points.map((index) => `star-${index}`),
                tags: [],
                mainTopic: `主题 ${clusterId}`,
                subTopics: [`子主题 ${clusterId}-1`, `子主题 ${clusterId}-2`],
                relatedClusters: [],
                relevanceScore: Math.random() * 0.5 + 0.5,
                qualityScore: Math.random() * 0.5 + 0.5
            });
        }
        return clusters;
    }
    generateMockStarMap(starCount) {
        const coordinates = [];
        const embeddings = [];
        const clustering = {
            clusters: {},
            labels: []
        };
        for (let i = 0; i < starCount; i++) {
            const clusterId = Math.floor(Math.random() * 5);
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 40 + 10;
            const height = (Math.random() - 0.5) * 20;
            const x = Math.cos(angle) * distance + clusterId * 10;
            const y = height;
            const z = Math.sin(angle) * distance + clusterId * 5;
            coordinates.push([x, y, z]);
            const embedding = Array.from({ length: 10 }, () => Math.random() - 0.5 + clusterId * 0.1);
            embeddings.push(embedding);
            clustering.labels.push(clusterId);
            if (!clustering.clusters[clusterId]) {
                clustering.clusters[clusterId] = {
                    center: [0, 0, 0],
                    points: []
                };
            }
            clustering.clusters[clusterId].points.push(i);
        }
        for (const [clusterId, clusterData] of Object.entries(clustering.clusters)) {
            const totalPoints = clusterData.points.length;
            const center = [0, 0, 0];
            clusterData.points.forEach(pointIndex => {
                const point = coordinates[pointIndex];
                center[0] += point[0];
                center[1] += point[1];
                center[2] += point[2];
            });
            center[0] /= totalPoints;
            center[1] /= totalPoints;
            center[2] /= totalPoints;
            clustering.clusters[clusterId].center = center;
        }
        return {
            coordinates,
            embeddings,
            clustering
        };
    }
    calculateRelevanceScore(result) {
        let score = 0.5;
        if (result.content.length > 100) {
            score += 0.2;
        }
        const trustedSources = ['wikipedia.org', 'github.com', 'arxiv.org', 'nature.com', 'science.org'];
        if (trustedSources.some(source => result.source.includes(source))) {
            score += 0.3;
        }
        return Math.min(1.0, Math.max(0.1, score));
    }
    calculateQualityScore(result) {
        let score = 0.5;
        if (result.tags.length > 3) {
            score += 0.2;
        }
        if (result.author.length > 0 && result.author[0] !== 'Unknown') {
            score += 0.3;
        }
        return Math.min(1.0, Math.max(0.1, score));
    }
    calculateColorFromTags(tags) {
        const tagHash = tags.reduce((hash, tag) => {
            for (let i = 0; i < tag.length; i++) {
                hash = ((hash << 5) - hash) + tag.charCodeAt(i);
                hash = hash & hash;
            }
            return hash;
        }, 0);
        const hue = (tagHash % 360 + 360) % 360;
        const saturation = 70 + (tagHash % 30);
        const lightness = 50 + (tagHash % 20);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    getColorFromClusterCenter(center) {
        const hue = (Math.abs(center[0] + center[1] + center[2]) % 360);
        return `hsl(${hue}, 70%, 50%)`;
    }
    getRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [dag_service_1.DagService])
], SearchService);
//# sourceMappingURL=search.service.js.map