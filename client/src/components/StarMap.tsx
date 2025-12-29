import { useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { StarPoint } from '../types';
import { useKeyboardControl } from '../hooks/useKeyboardControl';
import { useCameraFlight } from '../hooks/useCameraFlight';
import { StarHoverPreview } from './StarHoverPreview';
import { VisibleStarInfoCards } from './VisibleStarInfoCards';
import { SubspaceGeometryPlanes } from './SubspaceGeometryPlanes';

interface StarMapProps {
  stars: StarPoint[];
  // clusters: StarCluster[];
  onStarHover: (star: StarPoint | null) => void;
  onStarClick: (star: StarPoint | null) => void;
  isFlying: boolean;
  targetPosition: THREE.Vector3 | null;
  targetLookAt: THREE.Vector3 | null;
  onFlightComplete: () => void;
}

export const StarMap = ({ 
  stars = [], 
  // clusters = [], 
  onStarHover = () => {},
  onStarClick = () => {},
  isFlying,
  targetPosition,
  targetLookAt,
  onFlightComplete
}: StarMapProps) => {
  const { camera, mouse } = useThree();
  const pointsRef = useRef<THREE.Points | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const prevIntersect = useRef<string | null>(null);
  
  // 星点悬停状态
  const [hoveredStar, setHoveredStar] = useState<StarPoint | null>(null);
  
  // 使用键盘控制hook
  const { updateCameraPosition } = useKeyboardControl();
  
  // 使用相机飞行hook
  const { updateCameraFlight } = useCameraFlight({
    isFlying,
    targetPosition,
    targetLookAt,
    camera,
    onFlightComplete
  });
  
  // 图谱化连线系统
  const createConnectionLines = () => {
    // 存储不同类型的连线
    const linesData = {
      author: [] as number[],   // 作者连线
      related: [] as number[],  // 相关星点连线
      theme: [] as number[]     // 主题连线
    };
    
    // 1. 作者连线 - 连接同一作者的星点
    const authorMap = new Map<string, StarPoint[]>();
    
    // 按作者分组星点
    stars.forEach(star => {
      if (star && star.author) {
        star.author.forEach(author => {
          if (!authorMap.has(author)) {
            authorMap.set(author, []);
          }
          authorMap.get(author)?.push(star);
        });
      }
    });
    
    // 为每个作者的星点创建连线，按发布时间排序
    authorMap.forEach((authorStars) => {
      if (authorStars.length > 1) {
        // 按发布时间排序星点
        const sortedStars = [...authorStars].sort((a, b) => {
          const dateA = new Date(a.publishDate).getTime();
          const dateB = new Date(b.publishDate).getTime();
          return dateA - dateB;
        });
        
        // 为排序后的星点创建连线
        for (let i = 0; i < sortedStars.length - 1; i++) {
          const star1 = sortedStars[i];
          const star2 = sortedStars[i + 1];
          if (star1 && star2 && star1.position && star2.position) {
            linesData.author.push(
              star1.position.x, star1.position.y, star1.position.z,
              star2.position.x, star2.position.y, star2.position.z
            );
          }
        }
      }
    });
    
    // 2. 相关星点连线 - 基于relatedStars字段
    stars.forEach(star => {
      if (star && star.relatedStars && star.relatedStars.length > 0) {
        // 获取前5个相关星点，增加关联性
        const topRelatedStars = star.relatedStars.slice(0, 5);
        
        topRelatedStars.forEach(relatedStarInfo => {
          // 查找相关星点的完整信息
          const relatedStar = stars.find(s => s.id === relatedStarInfo.id);
          if (relatedStar && star.position && relatedStar.position) {
            // 根据权重调整连线粗细 - 注释掉未使用的变量
            // const weight = relatedStarInfo.weight || 0.5;
            
            linesData.related.push(
              star.position.x, star.position.y, star.position.z,
              relatedStar.position.x, relatedStar.position.y, relatedStar.position.z
            );
          }
        });
      }
    });
    
    // 3. 主题连线 - 连接相同标签的星点
    const tagMap = new Map<string, StarPoint[]>();
    
    // 按标签分组星点
    stars.forEach(star => {
      if (star && star.tags) {
        star.tags.forEach(tag => {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, []);
          }
          tagMap.get(tag)?.push(star);
        });
      }
    });
    
    // 为每个标签的星点创建连线（仅连接主要星点）
    tagMap.forEach((tagStars) => {
      if (tagStars.length > 3) {
        // 只连接权重最高的前5个星点
        const topStars = [...tagStars].sort((a, b) => {
          const relevanceA = (a as any).relevanceScore || 0;
          const relevanceB = (b as any).relevanceScore || 0;
          return relevanceB - relevanceA;
        }).slice(0, 5);
        
        // 创建星形连接
        for (let i = 0; i < topStars.length; i++) {
          for (let j = i + 1; j < topStars.length; j++) {
            const star1 = topStars[i];
            const star2 = topStars[j];
            if (star1 && star2 && star1.position && star2.position) {
              linesData.theme.push(
                star1.position.x, star1.position.y, star1.position.z,
                star2.position.x, star2.position.y, star2.position.z
              );
            }
          }
        }
      }
    });
    
    return {
      author: new Float32Array(linesData.author),
      related: new Float32Array(linesData.related),
      theme: new Float32Array(linesData.theme)
    };
  };
  
  const connectionLines = createConnectionLines();

  // 基于标签创建上下文知识集群
  const tagClusters = new Map<string, StarPoint[]>();
  
  // 按标签分组星点
  stars.forEach(star => {
    if (star && star.tags && star.tags.length > 0) {
      star.tags.forEach(tag => {
        if (!tagClusters.has(tag)) {
          tagClusters.set(tag, []);
        }
        tagClusters.get(tag)?.push(star);
      });
    }
  });
  
  // 为每个标签集群创建中心位置
  const tagClusterCenters = new Map<string, THREE.Vector3>();
  tagClusters.forEach((clusterStars, tag) => {
    if (clusterStars.length > 2) { // 只有包含3个以上星点的标签才创建集群中心
      const center = new THREE.Vector3(0, 0, 0);
      clusterStars.forEach(star => {
        if (star && star.position) {
          center.x += star.position.x;
          center.y += star.position.y;
          center.z += star.position.z;
        }
      });
      center.x /= clusterStars.length;
      center.y /= clusterStars.length;
      center.z /= clusterStars.length;
      tagClusterCenters.set(tag, center);
    }
  });
  
  // 合并实际星点，不生成额外的远处空星点，减少内存占用
  // 远处的星空效果通过专门的星空背景实现
  const allStars = stars;
  
  // 准备星点数据用于Points组件
  const positionsArray = allStars.flatMap(star => {
    if (star && star.position) {
      return [star.position.x, star.position.y, star.position.z];
    }
    return [0, 0, 0];
  });
  
  const colorsArray = allStars.flatMap(star => {
    if (star && star.color) {
      const hex = star.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return [r, g, b];
    }
    return [1, 1, 1]; // 默认白色
  });

  // 转换为Float32Array
  const positions = new Float32Array(positionsArray);
  const colors = new Float32Array(colorsArray);

  // 检测星点是否在相机可视范围内
  const isStarInView = (star: StarPoint): boolean => {
    if (!star || !star.position) return false;
    
    const starPosition = new THREE.Vector3(
      star.position.x,
      star.position.y,
      star.position.z
    );
    
    // 将星点位置转换为屏幕坐标
    const screenPos = starPosition.clone().project(camera);
    
    // 检查星点是否在屏幕范围内
    return (
      screenPos.x >= -1 &&
      screenPos.x <= 1 &&
      screenPos.y >= -1 &&
      screenPos.y <= 1 &&
      screenPos.z > 0 // 确保星点在相机前方
    );
  };
  
  // 移除未使用的函数
  // const getStarGlowIntensity = (star: StarPoint): number => {
  //   if (!star || !star.position) return 0;
  //   
  //   const starPosition = new THREE.Vector3(
  //     star.position.x,
  //     star.position.y,
  //     star.position.z
  //   );
  //   
  //   const distance = camera.position.distanceTo(starPosition);
  //   
  //   // 距离越近，发光越强
  //   return Math.max(0, 1 - distance / 30);
  // };
  
  // 获取星点的LOD级别
  const getStarLODLevel = (star: StarPoint): number => {
    if (!star || !star.position) return 0;
    
    // 远处空星点不显示信息卡片
    if (star.id.startsWith('far-star-')) {
      return 0;
    }
    
    const starPosition = new THREE.Vector3(
      star.position.x,
      star.position.y,
      star.position.z
    );
    
    const distance = camera.position.distanceTo(starPosition);
    
    // 根据距离确定LOD级别，大幅增加视距，让卡片在更远的距离才显示
    if (distance < 15) {
      return 3; // 最高级别，显示完整信息
    } else if (distance < 35) {
      return 2; // 中级，显示标题和作者
    } else if (distance < 55) {
      return 1; // 低级，只显示标题
    } else {
      return 0; // 不显示信息
    }
  };
  
  // 存储可视范围内的星点及其LOD级别
  const [visibleStars, setVisibleStars] = useState<Array<{star: StarPoint, lod: number}>>([]);
  
  // 每帧检测鼠标与星点的交互，以及可视范围内的星点
  useFrame(() => {
    // 键盘控制摄像机移动
    updateCameraPosition();
    
    // 相机飞行更新
    updateCameraFlight();

    // 检测可视范围内的星点，并计算LOD级别
    const inViewStars = allStars
      .filter(star => isStarInView(star))
      .map(star => ({ star, lod: getStarLODLevel(star) }))
      .filter(item => item.lod > 0); // 只保留需要显示信息的星点
    
    setVisibleStars(inViewStars);
    
    // 鼠标悬停检测 - 只有当pointsRef.current和geometry都存在时才进行raycast
    if (mouse && camera && raycaster.current && pointsRef.current) {
      // 确保geometry和attributes.position都存在
      if (pointsRef.current.geometry && 
          pointsRef.current.geometry.attributes && 
          pointsRef.current.geometry.attributes.position &&
          pointsRef.current.geometry.attributes.position.count > 0) {
        
        raycaster.current.setFromCamera(mouse, camera);
        const intersects = raycaster.current.intersectObject(pointsRef.current);
        
        if (intersects.length > 0 && intersects[0].index !== undefined) {
          const index = Math.floor(intersects[0].index);
          // 确保visibleStarIndices[index]存在
          if (index >= 0 && index < visibleStarIndices.length) {
            const star = allStars[visibleStarIndices[index]];
            if (star && star.id && star.id !== prevIntersect.current) {
              // 只处理实际星点，忽略远处空星点
              if (!star.id.startsWith('far-star-')) {
                prevIntersect.current = star.id as any;
                setHoveredStar(star);
                onStarHover(star);
              }
            }
          }
        } else {
          if (prevIntersect.current !== null) {
            prevIntersect.current = null;
            setHoveredStar(null);
            onStarHover(null);
          }
        }
      } else {
        // 如果没有有效的geometry，重置悬停状态
        if (prevIntersect.current !== null) {
          prevIntersect.current = null;
          setHoveredStar(null);
          onStarHover(null);
        }
      }
    }
  });

  // 生成可视星点数据 - 使用更高效的过滤方式
  const visibleStarIndices: number[] = [];
  for (let i = 0; i < allStars.length; i++) {
    if (isStarInView(allStars[i])) {
      visibleStarIndices.push(i);
    }
  }
  
  // 创建可视星点的缓冲区数据
  const visiblePositions = new Float32Array(visibleStarIndices.length * 3);
  const visibleColors = new Float32Array(visibleStarIndices.length * 3);
  
  visibleStarIndices.forEach((index, i) => {
    // 复制位置数据
    visiblePositions[i * 3] = positions[index * 3];
    visiblePositions[i * 3 + 1] = positions[index * 3 + 1];
    visiblePositions[i * 3 + 2] = positions[index * 3 + 2];
    
    // 复制颜色数据
    visibleColors[i * 3] = colors[index * 3];
    visibleColors[i * 3 + 1] = colors[index * 3 + 1];
    visibleColors[i * 3 + 2] = colors[index * 3 + 2];
  });
  
  // 如果没有可视星点，只渲染必要元素
  if (visibleStarIndices.length === 0) {
    return (
      <group>
        <StarHoverPreview hoveredStar={hoveredStar} mouse={mouse} />
        <VisibleStarInfoCards visibleStars={visibleStars} />
      </group>
    );
  }
  
  return (
    <group>
      
      {/* 图谱化连线 - 作者连线 */}
      {connectionLines.author.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute args={[connectionLines.author, 3]} name="position" />
          </bufferGeometry>
          <lineBasicMaterial color="#4ECDC4" transparent={true} opacity={0.6} linewidth={2} />
        </lineSegments>
      )}
      
      {/* 图谱化连线 - 相关星点连线 */}
      {connectionLines.related.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute args={[connectionLines.related, 3]} name="position" />
          </bufferGeometry>
          <lineBasicMaterial color="#FF6B6B" transparent={true} opacity={0.5} linewidth={1.5} />
        </lineSegments>
      )}
      
      {/* 图谱化连线 - 主题连线 */}
      {connectionLines.theme.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute args={[connectionLines.theme, 3]} name="position" />
          </bufferGeometry>
          <lineBasicMaterial color="#FFD166" transparent={true} opacity={0.4} linewidth={1} />
        </lineSegments>
      )}

      {/* 标签集群可视化 - 将具有相同标签的星点归为一类 */}
      {Array.from(tagClusterCenters.entries()).map(([tag, center]) => (
        <group key={`tag-${tag}`} position={[center.x, center.y, center.z]}>
          {/* 标签名称 - 使用Html组件显示标签名称 */}
          <Html position={[0, 0, 0]}>
            <div className="tag-cluster-label">
              <h5>{tag}</h5>
              <p>{tagClusters.get(tag)?.length || 0} 个星点</p>
            </div>
          </Html>
        </group>
      ))}

      {/* 星点主图层 - 增强视觉效果 */}
      <points 
        ref={pointsRef} 
        onClick={(event) => {
          // 检查是否有星点被点击
          if (event.intersections && event.intersections.length > 0 && event.intersections[0].index !== undefined) {
            const index = Math.floor(event.intersections[0].index);
            const star = allStars[visibleStarIndices[index]];
            if (star && !star.id.startsWith('far-star-')) { // 只处理实际星点
              onStarClick(star);
            }
          }
        }}
      >
        <bufferGeometry>
          <bufferAttribute args={[visiblePositions, 3]} name="position" count={visibleStarIndices.length} />
          <bufferAttribute args={[visibleColors, 3]} name="color" count={visibleStarIndices.length} />
        </bufferGeometry>
        <pointsMaterial 
          size={0.6} 
          sizeAttenuation={true} 
          vertexColors={true}
          transparent={true}
          opacity={0.9}
          depthTest={true}
          blending={THREE.NormalBlending}
        />
      </points>
      
      {/* 星点发光效果 - 更柔和的光晕效果 */}
      <points>
        <bufferGeometry>
          <bufferAttribute args={[visiblePositions, 3]} name="position" count={visibleStarIndices.length} />
          <bufferAttribute args={[visibleColors, 3]} name="color" count={visibleStarIndices.length} />
        </bufferGeometry>
        <pointsMaterial 
          size={2.0} 
          sizeAttenuation={true} 
          vertexColors={true}
          transparent={true}
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      
      {/* 星点光晕效果 - 最外层的柔和光晕 */}
      <points>
        <bufferGeometry>
          <bufferAttribute args={[visiblePositions, 3]} name="position" count={visibleStarIndices.length} />
          <bufferAttribute args={[visibleColors, 3]} name="color" count={visibleStarIndices.length} />
        </bufferGeometry>
        <pointsMaterial 
          size={3.5} 
          sizeAttenuation={true} 
          vertexColors={true}
          transparent={true}
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      
      {/* 星点悬停预览 */}
      <StarHoverPreview hoveredStar={hoveredStar} mouse={mouse} />
      
      {/* 可视范围内星点的LOD分级信息卡片 */}
      <VisibleStarInfoCards visibleStars={visibleStars} />
    </group>
  );
};
