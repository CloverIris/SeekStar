import { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import './App.css'
import { StarMap } from './components/StarMap'
import type { StarPoint, StarCluster } from './types'
import { Header } from './components/Header'
import { InfoPanel } from './components/InfoPanel'
import { StarInfoPanel } from './components/StarInfoPanel'
import { SplashScreen } from './components/SplashScreen'
import { TelescopeControlPanel } from './components/TelescopeControlPanel'
import { NearbyStarsList } from './components/NearbyStarsList'

// 后端统一响应格式类型
type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: number;
  requestId: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
};

// 搜索响应数据类型
type SearchData = {
  stars: StarPoint[];
  clusters: StarCluster[];
};

function App() {
  const [query, setQuery] = useState('');
  const [stars, setStars] = useState<StarPoint[]>([]);
  const [clusters, setClusters] = useState<StarCluster[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredStar, setHoveredStar] = useState<StarPoint | null>(null);
  const [isSplashActive, setIsSplashActive] = useState(true);
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 20));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // 高级效果状态
  const [isFlying, setIsFlying] = useState(false);
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null);
  const [targetLookAt, setTargetLookAt] = useState<THREE.Vector3 | null>(null);
  
  // 懒加载相关状态
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  
  // 相机引用，用于控制FOV和距离
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const previousCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  
  // 飞行完成回调
  const handleFlightComplete = () => {
    setIsFlying(false);
  };
  
  // 加载更多结果 - 移到useEffect之前，解决声明前使用的问题
  const loadMoreResults = async () => {
    if (isLoadingMore || isFlying || !query.trim()) return;
    
    setIsLoadingMore(true);
    
    try {
      const nextOffset = searchOffset + 200;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim(), limit: 200, offset: nextOffset }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData: ApiResponse<SearchData> = await response.json();
      
      if (responseData.success && responseData.data) {
        const { stars: newStars } = responseData.data;
        if (newStars && newStars.length > 0) {
          // 合并新结果到现有结果中，并去重
          setStars(prevStars => {
            const combinedStars = [...prevStars, ...newStars];
            // 去重并确保总数不超过200个
            const uniqueStars = combinedStars
              .filter((star, index, self) => index === self.findIndex((s) => s.id === star.id))
              .slice(0, 200);
            return uniqueStars;
          });
          // 更新偏移量
          setSearchOffset(nextOffset);
        }
      } else {
        console.error('Failed to load more results:', responseData.error || responseData.message);
      }
    } catch (err) {
      console.error('Failed to load more results:', err);
      // 加载更多失败时不显示错误信息，避免干扰用户体验
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  // 监听相机位置变化，实时更新控制台参数和cameraPosition状态
  useEffect(() => {
    if (!cameraRef.current) return;
    
    const camera = cameraRef.current;
    let lastLoadTime = Date.now();
    const loadDelay = 2000; // 增加延迟到2秒，减少不必要的加载
    const positionThreshold = 0.5; // 增加位置变化阈值，减少不必要的更新
    
    const checkCameraChange = () => {
      const distanceChanged = camera.position.distanceTo(previousCameraPosition.current) > positionThreshold;
      
      if (distanceChanged) {
        // 相机位置变化，更新控制台参数
        previousCameraPosition.current.copy(camera.position);
        // 更新cameraPosition状态，用于NearbyStarsList组件
        setCameraPosition(camera.position.clone());
        // 控制台会通过camera prop自动获取最新参数
        
        // 触发懒加载，限制频率
        const currentTime = Date.now();
        if (currentTime - lastLoadTime > loadDelay) {
          loadMoreResults();
          lastLoadTime = currentTime;
        }
      }
    };
    
    // 使用setInterval替代requestAnimationFrame，减少计算频率
    const intervalId = setInterval(checkCameraChange, 100); // 每100ms检查一次
    
    return () => {
      clearInterval(intervalId);
    };
  }, [loadMoreResults, stars.length]);

  // 星点点击事件处理
  const handleStarClick = (star: StarPoint | null) => {
    // 如果点击了星点，执行"意外跳转"推荐
    if (star && star.relatedStars && star.relatedStars.length > 0) {
      // 随机选择一个相关星点作为推荐
      const randomIndex = Math.floor(Math.random() * star.relatedStars.length);
      const recommendedStarId = star.relatedStars[randomIndex].id;
      const recommendedStar = stars.find(s => s.id === recommendedStarId);
      
      // 可以将推荐星点存储到状态中，以便在UI中显示
      console.log('意外跳转推荐:', recommendedStar);
    }
  };

  // 导出星图快照
  const exportSnapshot = () => {
    try {
      if (canvasRef?.current) {
        // 获取canvas元素
        const canvas = canvasRef.current;
        // 导出为PNG格式
        const dataURL = canvas?.toDataURL?.('image/png') || '';
        if (dataURL) {
          // 创建下载链接
          const link = document.createElement('a');
          link.download = `seekstar-snapshot-${Date.now()}.png`;
          link.href = dataURL;
          link.click();
        }
      }
    } catch (err) {
      console.error('Failed to export snapshot:', err);
      setError('Failed to export snapshot. Please try again.');
      // 3秒后清除错误信息
      setTimeout(() => setError(null), 3000);
    }
  };

  // 导出引用信息（Markdown格式）
  const exportReferences = () => {
    try {
      // 生成Markdown格式的引用，添加严格的空值检查
      const markdown = `# SeekStar Search Results\n\n` +
        `**Query:** ${query || '未指定'}\n\n` +
        `**Results Count:** ${stars?.length || 0}\n\n` +
        `## References\n\n` +
        (stars || []).map((star, index) => {
          return `${index + 1}. **[${star?.title || '未命名'}](${star?.url || '#'})**\n` +
                 `   - Author: ${(star?.author || []).join(', ') || '未知'}\n` +
                 `   - Source: ${star?.source || '未知'}\n` +
                 `   - Tags: ${(star?.tags || []).join(', ') || '无'}\n\n`;
        }).join('');
      
      // 创建下载链接
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `seekstar-references-${Date.now()}.md`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export references:', err);
      setError('Failed to export references. Please try again.');
      // 3秒后清除错误信息
      setTimeout(() => setError(null), 3000);
    }
  };

  // 搜索功能
  const handleSearch = async (e: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) return;

    setIsLoading(true);
    setError(null);
    // 重置懒加载状态
    setSearchOffset(0);
    // 清除旧内容
    setStars([]);
    setClusters([]);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: trimmedQuery, limit: 200, offset: 0 }),
      });

      const responseData: ApiResponse<SearchData> = await response.json();

      if (responseData.success && responseData.data) {
        const { stars: newStars, clusters: newClusters } = responseData.data;
        // 确保星点总数不超过200个，并去重
        const finalStars = newStars?.slice(0, 200).filter((star, index, self) => 
          index === self.findIndex((s) => s.id === star.id)
        ) || [];
        const finalClusters = newClusters?.filter(cluster => 
          finalStars.some(star => star.clusterId === cluster.id)
        ) || [];
        
        setStars(finalStars);
        setClusters(finalClusters);
        
        // 计算目标位置和观察点，触发镜头飞行
        if (finalClusters && finalClusters.length > 0) {
          // 选择第一个星团作为目标
          const targetCluster = finalClusters[0];
          // 设置目标位置（相机位置）
          const targetPos = new THREE.Vector3(
            targetCluster.position.x,
            targetCluster.position.y,
            targetCluster.position.z + 10 // 相机在星团后方10个单位
          );
          // 设置观察点（星团中心）
          const lookAtPos = new THREE.Vector3(
            targetCluster.position.x,
            targetCluster.position.y,
            targetCluster.position.z
          );
          
          setTargetPosition(targetPos);
          setTargetLookAt(lookAtPos);
          setIsFlying(true);

        } else if (finalStars && finalStars.length > 0) {
          // 如果没有星团，选择第一个星点作为目标
          const targetStar = finalStars[0];
          const targetPos = new THREE.Vector3(
            targetStar.position.x,
            targetStar.position.y,
            targetStar.position.z + 10
          );
          const lookAtPos = new THREE.Vector3(
            targetStar.position.x,
            targetStar.position.y,
            targetStar.position.z
          );
          
          setTargetPosition(targetPos);
          setTargetLookAt(lookAtPos);
          setIsFlying(true);
        }
      } else {
        const errorMessage = responseData.error?.message || responseData.message || '搜索失败，请稍后重试';
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '网络连接失败，请检查后端服务是否运行';
      setError(errorMessage);
      console.error('Search error:', err);
      // 5秒后清除错误信息，给用户足够时间阅读
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 处理开屏完成
  const handleSplashComplete = (splashStars: StarPoint[]) => {
    setIsSplashActive(false);
    // 直接执行初始搜索，不再使用随机星点，避免重复设置
    // 这样可以确保用户看到的是真实搜索结果，而不是中间的随机星点
    performInitialSearch();
  };

  // 执行初始搜索
  const performInitialSearch = async () => {
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query, limit: 200, offset: 0 }),
      });

      const responseData: ApiResponse<SearchData> = await response.json();
      console.log('Initial search data:', responseData);
      if (responseData.success && responseData.data) {
        const { stars: newStars, clusters: newClusters } = responseData.data;
        // 去重后设置星点和星团
        const uniqueStars = newStars?.filter((star, index, self) => 
          index === self.findIndex((s) => s.id === star.id)
        ) || [];
        const uniqueClusters = newClusters?.filter(cluster => 
          uniqueStars.some(star => star.clusterId === cluster.id)
        ) || [];
        setStars(uniqueStars);
        setClusters(uniqueClusters);
      } else {
        const errorMessage = responseData.error?.message || responseData.message || `初始搜索失败`;
        console.error('Initial search failed:', errorMessage);
        // 初始搜索失败时不显示错误信息，避免影响用户体验
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '网络连接失败，无法执行初始搜索';
      console.error('Initial search error:', errorMessage);
      // 初始搜索失败时不显示错误信息，避免影响用户体验
    } finally {
      setIsLoading(false);
    }
  };
  
  // 初始化时设置默认搜索词和加载开屏效果
  useEffect(() => {
    // 默认搜索一个示例关键词
    setQuery('artificial intelligence');
  }, []);

  return (
    <div className="app">
      {/* 开屏效果 */}
      {isSplashActive && <SplashScreen onSplashComplete={handleSplashComplete} />}
      
      {/* 左侧临近星点列表 */}
      <NearbyStarsList 
        stars={stars}
        hoveredStar={hoveredStar}
        onStarClick={handleStarClick}
        cameraPosition={cameraPosition}
      />
      
      {/* 头部区域 */}
      <Header
        query={query}
        isLoading={isLoading}
        error={error}
        onQueryChange={setQuery}
        onSearch={handleSearch}
      />
      
      {/* 3D 星图画布 */}
      <div className="canvas-container">
        <Canvas 
          camera={{ position: [0, 0, 20], fov: 75 }} 
          gl={{ preserveDrawingBuffer: true }} // 保存绘图缓冲区，以便导出快照
          onCreated={({ gl, camera }) => {
            canvasRef.current = gl.domElement;
            cameraRef.current = camera as THREE.PerspectiveCamera;
          }}
        >
          {/* 渐变背景 - 更柔和的宇宙感 */}
          <rectAreaLight 
            width={100} 
            height={100} 
            intensity={0.5} 
            position={[0, 0, 50]} 
            color="#001133"
          />
          
          {/* 柔和环境光 */}
          <ambientLight intensity={0.3} color="#e0e0ff" />
          
          {/* 暖色调点光源 */}
          <pointLight position={[10, 10, 10]} intensity={0.8} color="#f0e0d0" />
          
          {/* 冷色调点光源 - 增强层次感 */}
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#d0e0f0" />
          

          
          {/* 星图 */}
          <StarMap 
            stars={stars} 
            onStarHover={setHoveredStar}
            onStarClick={handleStarClick}
            isFlying={isFlying}
            targetPosition={targetPosition}
            targetLookAt={targetLookAt}
            onFlightComplete={handleFlightComplete}
          />
        </Canvas>
      </div>
      
      {/* 信息面板 */}
      <InfoPanel
        starsCount={stars.length}
        clustersCount={clusters.length}
        query={query}
        onExportSnapshot={exportSnapshot}
        onExportReferences={exportReferences}
      />

      {/* 星点详细信息面板 */}
      <StarInfoPanel star={hoveredStar} />
      
      {/* 望远镜控制台 */}
      {cameraRef.current && (
        <TelescopeControlPanel 
          camera={cameraRef.current} 
          onParamsChange={(params) => {
            console.log('相机参数变化:', params);
          }} 
        />
      )}
    </div>
  );
}

export default App
