import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { StarPointDto } from './dto/star-point.dto';
import { StarClusterDto } from './dto/star-cluster.dto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import { DagService } from '../dag/dag.service';

// Define interface for cluster data structure
interface ClusterData {
  center: number[];
  points: number[];
}

// Define interface for clustering result
interface ClusteringResult {
  clusters: Record<string, ClusterData>;
  labels: number[];
}

// Define interface for star map response
interface StarMapResponse {
  coordinates: number[][];
  embeddings: number[][];
  clustering: ClusteringResult;
}

@Injectable()
export class SearchService {
  private readonly aiServiceUrl: string;

  constructor(private readonly dagService: DagService) {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  }

  async search(request: SearchRequestDto): Promise<SearchResponseDto> {
    try {
      // Step 1: 使用DAG服务执行搜索
      const dagResult = await this.dagService.executeDagSearch(request.query);
      
      // Step 2: 获取真实搜索结果
      const searchResults = await this.fetchRealSearchResults(request.query, request.limit || 100);
      
      // Extract texts from search results
      const texts = searchResults.map(result => result.title + ' ' + result.content);
      
      // Step 3: Generate star map using AI service or fallback to mock data
      let starMapResponse: StarMapResponse;
      try {
        starMapResponse = await this.generateStarMap(texts);
      } catch (aiError) {
        console.warn('AI service unavailable, using mock star map data:', aiError.message);
        // Generate mock star map data
        starMapResponse = this.generateMockStarMap(searchResults.length);
      }
      
      // Step 4: Format results into the expected response structure
      const searchId = uuidv4();
      const starMapId = uuidv4();
      
      // 确保搜索结果不包含重复项（基于URL）
      const uniqueSearchResults = searchResults.filter((result, index, self) => 
        index === self.findIndex((s) => s.url === result.url)
      );
      
      // 确保AI服务返回的数据与去重后的搜索结果数量匹配
      const adjustedCoordinates = starMapResponse.coordinates.slice(0, uniqueSearchResults.length);
      const adjustedEmbeddings = starMapResponse.embeddings.slice(0, uniqueSearchResults.length);
      const adjustedClusterLabels = starMapResponse.clustering.labels.slice(0, uniqueSearchResults.length);
      
      // Map AI service results to our DTOs
      const stars = this.mapToStarPoints(uniqueSearchResults, adjustedCoordinates, adjustedEmbeddings, adjustedClusterLabels);
      const clusters = this.mapToStarClusters(starMapResponse.clustering);
      
      // Step 5: 根据DAG结果增强星点之间的关系
      this.enhanceStarRelations(stars, clusters, dagResult);
      
      return {
        searchId,
        query: request.query,
        starMapId,
        estimatedCount: searchResults.length,
        stars,
        clusters
      };
    } catch (error) {
      console.error('Search service error:', error);
      throw new HttpException(
        'Failed to perform search',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 根据DAG结果增强星点之间的关系
   */
  private enhanceStarRelations(stars: StarPointDto[], clusters: StarClusterDto[], dagResult: any): void {
    // 如果DAG结果包含聚类信息，使用它来增强星点之间的关系
    if (dagResult.data.clusters) {
      dagResult.data.clusters.forEach((cluster: any) => {
        // 为同一聚类中的星点创建关联
        if (cluster.members && cluster.members.length > 1) {
          for (let i = 0; i < cluster.members.length; i++) {
            for (let j = i + 1; j < cluster.members.length; j++) {
              const star1 = stars[parseInt(cluster.members[i])];
              const star2 = stars[parseInt(cluster.members[j])];
              if (star1 && star2) {
                // 添加双向关联
                star1.relatedStars.push({ id: star2.id, weight: 0.8 });
                star2.relatedStars.push({ id: star1.id, weight: 0.8 });
              }
            }
          }
        }
      });
    }
    
    // 如果DAG结果包含实体关系，使用它来增强星点之间的关系
    if (dagResult.data.aiResults?.relations) {
      dagResult.data.aiResults.relations.forEach((relation: any) => {
        // 查找相关的星点并创建关联
        const relatedStars = stars.filter(star => 
          star.title.includes(relation[0]) || star.title.includes(relation[2]) ||
          star.content.includes(relation[0]) || star.content.includes(relation[2])
        );
        
        // 为相关星点创建关联
        for (let i = 0; i < relatedStars.length; i++) {
          for (let j = i + 1; j < relatedStars.length; j++) {
            relatedStars[i].relatedStars.push({ id: relatedStars[j].id, weight: 0.7 });
            relatedStars[j].relatedStars.push({ id: relatedStars[i].id, weight: 0.7 });
          }
        }
      });
    }
    
    // 基于相似度创建星点之间的关联
    this.createSimilarityRelations(stars);
  }
  
  /**
   * 基于相似度创建星点之间的关联
   */
  private createSimilarityRelations(stars: StarPointDto[]): void {
    // 简单的相似度计算，基于标题和标签的共同词
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const star1 = stars[i];
        const star2 = stars[j];
        
        // 计算标题相似度
        const titleSimilarity = this.calculateTextSimilarity(star1.title, star2.title);
        
        // 计算标签相似度
        const commonTags = star1.tags.filter(tag => star2.tags.includes(tag));
        const tagSimilarity = commonTags.length / Math.max(star1.tags.length, star2.tags.length);
        
        // 综合相似度
        const similarity = (titleSimilarity + tagSimilarity) / 2;
        
        // 如果相似度足够高，创建关联
        if (similarity > 0.3) {
          star1.relatedStars.push({ id: star2.id, weight: similarity });
          star2.relatedStars.push({ id: star1.id, weight: similarity });
        }
      }
    }
  }
  
  /**
   * 计算文本相似度（简单实现）
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const commonWords = Array.from(words1).filter(word => words2.has(word));
    const totalWords = new Set([...words1, ...words2]);
    
    return commonWords.length / totalWords.size;
  }

  private async generateStarMap(texts: string[]): Promise<StarMapResponse> {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/api/v1/starmap/generate`, {
        texts,
        n_neighbors: 15,
        min_dist: 0.1,
        min_cluster_size: 5
      });
      return response.data;
    } catch (error) {
      console.error('AI service error:', error);
      throw new HttpException(
        'Failed to generate star map',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async fetchRealSearchResults(query: string, limit: number): Promise<Array<{
    title: string;
    url: string;
    source: string;
    content: string;
    author: string[];
    publishDate: Date;
    tags: string[];
  }>> {
    try {
      // 使用axios+cheerio抓取Bing搜索结果
      const response = await axios.get('https://www.bing.com/search', {
        params: {
          q: query,
          count: limit * 2 // 获取更多结果，以便过滤
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const results: Array<{
        title: string;
        url: string;
        source: string;
        content: string;
        author: string[];
        publishDate: Date;
        tags: string[];
      }> = [];
      const seenUrls = new Set<string>(); // 用于去重的URL集合
      
      // 解析Bing搜索结果
      $('.b_algo').each((index, element) => {
        if (results.length >= limit) return false; // 达到限制数量
        
        // 提取标题和URL
        const titleElement = $(element).find('h2 a');
        const title = titleElement.text().trim();
        const url = titleElement.attr('href') || '';
        
        // 去重：跳过已处理的URL
        if (!url || seenUrls.has(url)) {
          return; // 继续处理下一个结果
        }
        seenUrls.add(url);
        
        // 提取摘要内容
        const contentElement = $(element).find('.b_caption p');
        const content = contentElement.text().trim() || `关于"${query}"的搜索结果 - ${title}`;
        
        // 提取来源信息
        const sourceMatch = url.match(/https?:\/\/(www\.)?([^\/]+)/);
        const source = sourceMatch ? sourceMatch[2] : 'Unknown';
        
        // 提取发布日期
        const dateElement = $(element).find('.b_dates');
        let publishDate = new Date();
        if (dateElement.length > 0) {
          const dateText = dateElement.text().trim();
          // 简单的日期解析，实际应用中需要更复杂的解析
          if (dateText.includes('天前')) {
            const daysAgo = parseInt(dateText.match(/(\d+)天前/)?.[1] || '0');
            publishDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          } else if (dateText.includes('周前')) {
            const weeksAgo = parseInt(dateText.match(/(\d+)周前/)?.[1] || '0');
            publishDate = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
          } else if (dateText.includes('月前')) {
            const monthsAgo = parseInt(dateText.match(/(\d+)月前/)?.[1] || '0');
            publishDate = new Date(Date.now() - monthsAgo * 30 * 24 * 60 * 60 * 1000);
          }
        }
        
        // 提取作者信息
        const authorMatch = content.match(/作者：([^，。]+)/);
        const author = authorMatch ? [authorMatch[1]] : [source];
        
        // 提取标签（简单实现，实际应用中需要更复杂的提取）
        const tags = [query, source.toLowerCase()];
        if (content.length > 50) {
          // 从内容中提取一些关键词作为标签
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
            tags: [...new Set(tags)] // 去重
          });
        }
      });
      
      // 如果没有获取到足够的结果，使用更智能的方式生成补充数据
      if (results.length < limit) {
        const additionalResults = this.generateAdditionalResults(query, limit - results.length, results);
        // 对补充结果也进行去重
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
    } catch (error) {
      console.error('Error fetching real search results from Bing:', error);
      // 如果真实搜索失败，使用基于查询词的智能生成结果
      console.warn('Falling back to intelligent generated results');
      return this.generateIntelligentResults(query, limit);
    }
  }

  /**
   * 基于现有结果生成补充结果
   */
  private generateAdditionalResults(query: string, limit: number, existingResults: any[]): Array<{
    title: string;
    url: string;
    source: string;
    content: string;
    author: string[];
    publishDate: Date;
    tags: string[];
  }> {
    const results: Array<{
      title: string;
      url: string;
      source: string;
      content: string;
      author: string[];
      publishDate: Date;
      tags: string[];
    }> = [];
    
    // 从现有结果中提取标签和作者
    const existingTags = new Set<string>();
    const existingAuthors = new Set<string>();
    
    existingResults.forEach(result => {
      result.tags.forEach((tag: string) => existingTags.add(tag));
      result.author.forEach((author: string) => existingAuthors.add(author));
    });
    
    // 生成补充结果
    for (let i = 0; i < limit; i++) {
      // 基于现有标签生成新的标题和内容
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
  
  /**
   * 当真实搜索失败时生成智能结果
   */
  private generateIntelligentResults(query: string, limit: number): Array<{
    title: string;
    url: string;
    source: string;
    content: string;
    author: string[];
    publishDate: Date;
    tags: string[];
  }> {
    const results: Array<{
      title: string;
      url: string;
      source: string;
      content: string;
      author: string[];
      publishDate: Date;
      tags: string[];
    }> = [];
    
    // 基于查询词生成相关主题
    const relatedTopics = [
      '介绍', '基础', '教程', '指南', '高级', '技术', '案例', '研究', '趋势', '应用',
      '原理', '实践', '工具', '资源', '社区', '生态', '发展', '挑战', '机遇'
    ];
    
    // 生成智能结果
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

  private mapToStarPoints(
    searchResults: any[],
    coordinates: number[][],
    embeddings: number[][],
    clusterLabels: number[]
  ): StarPointDto[] {
    return searchResults.map((result, index) => {
      const coordinate = coordinates[index] || [0, 0, 0];
      const embedding = embeddings[index] || [];
      
      // 基于结果质量和相关性计算大小和亮度
      const relevanceScore = this.calculateRelevanceScore(result);
      const qualityScore = this.calculateQualityScore(result);
      
      // 基于标签和内容计算颜色
      const color = this.calculateColorFromTags(result.tags);
      
      return {
        id: uuidv4(),
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
        size: relevanceScore * 2 + 0.5, // Size based on relevance (0.5 to 2.5)
        brightness: qualityScore * 0.7 + 0.3, // Brightness based on quality (0.3 to 1.0)
        color: color,
        clusterId: clusterLabels[index] === -1 ? undefined : `cluster-${clusterLabels[index]}`,
        relatedStars: [], // Will be populated based on similarity
        relevanceScore: relevanceScore,
        qualityScore: qualityScore
      };
    });
  }

  private mapToStarClusters(clusteringResult: ClusteringResult): StarClusterDto[] {
    const clusters: StarClusterDto[] = [];
    
    for (const [clusterId, clusterData] of Object.entries(clusteringResult.clusters)) {
      // 基于聚类中心生成颜色
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
        radius: Math.min(15, Math.max(5, clusterData.points.length / 10)), // Radius based on cluster size
        color: color,
        opacity: 0.6,
        starCount: clusterData.points.length,
        starIds: clusterData.points.map((index: number) => `star-${index}`),
        tags: [],
        mainTopic: `主题 ${clusterId}`,
        subTopics: [`子主题 ${clusterId}-1`, `子主题 ${clusterId}-2`],
        relatedClusters: [], // Will be populated based on cluster similarity
        relevanceScore: Math.random() * 0.5 + 0.5,
        qualityScore: Math.random() * 0.5 + 0.5
      });
    }
    
    return clusters;
  }

  private generateMockStarMap(starCount: number): StarMapResponse {
    // Generate mock star map data when AI service is unavailable
    const coordinates: number[][] = [];
    const embeddings: number[][] = [];
    const clustering: ClusteringResult = {
      clusters: {},
      labels: []
    };

    // Generate coordinates with some structure (not completely random)
    for (let i = 0; i < starCount; i++) {
      // Generate coordinates with some clustering structure
      const clusterId = Math.floor(Math.random() * 5);
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 40 + 10;
      const height = (Math.random() - 0.5) * 20;
      
      // Generate coordinates around cluster centers
      const x = Math.cos(angle) * distance + clusterId * 10;
      const y = height;
      const z = Math.sin(angle) * distance + clusterId * 5;
      coordinates.push([x, y, z]);

      // Generate embeddings with some structure
      const embedding = Array.from({ length: 10 }, () => 
        Math.random() - 0.5 + clusterId * 0.1 // Add some cluster structure to embeddings
      );
      embeddings.push(embedding);

      clustering.labels.push(clusterId);

      // Update cluster data
      if (!clustering.clusters[clusterId]) {
        clustering.clusters[clusterId] = {
          center: [0, 0, 0],
          points: []
        };
      }
      clustering.clusters[clusterId].points.push(i);
    }

    // Calculate cluster centers
    for (const [clusterId, clusterData] of Object.entries(clustering.clusters)) {
      const totalPoints = clusterData.points.length;
      const center = [0, 0, 0];

      // Sum all coordinates in the cluster
      clusterData.points.forEach(pointIndex => {
        const point = coordinates[pointIndex];
        center[0] += point[0];
        center[1] += point[1];
        center[2] += point[2];
      });

      // Calculate average (center)
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
  
  /**
   * 基于结果计算相关性分数
   */
  private calculateRelevanceScore(result: any): number {
    // 简单实现：基于内容长度、来源可信度等因素
    let score = 0.5;
    
    // 内容长度加分
    if (result.content.length > 100) {
      score += 0.2;
    }
    
    // 可信来源加分
    const trustedSources = ['wikipedia.org', 'github.com', 'arxiv.org', 'nature.com', 'science.org'];
    if (trustedSources.some(source => result.source.includes(source))) {
      score += 0.3;
    }
    
    return Math.min(1.0, Math.max(0.1, score));
  }
  
  /**
   * 基于结果计算质量分数
   */
  private calculateQualityScore(result: any): number {
    // 简单实现：基于标签数量、作者数量等因素
    let score = 0.5;
    
    // 标签数量加分
    if (result.tags.length > 3) {
      score += 0.2;
    }
    
    // 作者信息完整加分
    if (result.author.length > 0 && result.author[0] !== 'Unknown') {
      score += 0.3;
    }
    
    return Math.min(1.0, Math.max(0.1, score));
  }
  
  /**
   * 基于标签计算颜色
   */
  private calculateColorFromTags(tags: string[]): string {
    // 基于标签的哈希值生成颜色
    const tagHash = tags.reduce((hash, tag) => {
      for (let i = 0; i < tag.length; i++) {
        hash = ((hash << 5) - hash) + tag.charCodeAt(i);
        hash = hash & hash;
      }
      return hash;
    }, 0);
    
    // 将哈希值转换为颜色
    const hue = (tagHash % 360 + 360) % 360;
    const saturation = 70 + (tagHash % 30);
    const lightness = 50 + (tagHash % 20);
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  
  /**
   * 从聚类中心生成颜色
   */
  private getColorFromClusterCenter(center: number[]): string {
    // 基于聚类中心的坐标生成颜色
    const hue = (Math.abs(center[0] + center[1] + center[2]) % 360);
    return `hsl(${hue}, 70%, 50%)`;
  }
  
  /**
   * 获取随机颜色（备用方法）
   */
  private getRandomColor(): string {
    // Generate random vibrant colors
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
