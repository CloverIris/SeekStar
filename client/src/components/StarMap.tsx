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

  // 使用视锥体检测星点是否在相机可视范围内
  // 基于3D CG软件工作区思路，确保近距离物体不会消失
  const isStarInView = (star: StarPoint): boolean => {
    if (!star || !star.position) return false;
    
    // 首先检查星点是否在相机前方
    const starPosition = new THREE.Vector3(
      star.position.x,
      star.position.y,
      star.position.z
    );
    
    // 计算星点到相机的向量
    const direction = starPosition.clone().sub(camera.position).normalize();
    
    // 计算相机前方向量
    const cameraForward = new THREE.Vector3(0, 0, -1);
    cameraForward.applyQuaternion(camera.quaternion);
    
    // 点积计算，判断星点是否在相机前方
    const dotProduct = direction.dot(cameraForward);
    if (dotProduct < 0) return false;
    
    // 使用视锥体检测星点是否在可视范围内
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    
    // 更新视锥体矩阵
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    
    // 检查星点是否在视锥体内
    return frustum.containsPoint(starPosition);
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
  
  // 获取星点的LOD级别 - 基于3D CG软件工作区思路
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
    
    // 计算星点在屏幕上的大小
    const screenSize = 1000 * (1 / (distance * camera.fov / 180));
    
    // 3D CG软件工作区思路：
    // 1. 近距离物体不会消失，始终保持可见
    // 2. 根据屏幕大小调整LOD级别
    // 3. 平滑过渡，避免突然消失
    // 4. 确保重要信息始终可见
    
    // 非常近时显示完整信息
    if (distance < 10 || screenSize > 20) {
      return 3; // 最高级别，显示完整信息
    } 
    // 中等距离，根据屏幕大小调整
    else if (distance < 30 || screenSize > 10) {
      return 3; // 保持最高级别，确保信息可见
    } 
    // 稍远一些，显示简化信息
    else if (distance < 60 || screenSize > 5) {
      return 2; // 中级，显示标题和作者
    } 
    // 远距离，只显示标题
    else if (distance < 100 || screenSize > 2) {
      return 1; // 低级，只显示标题
    } 
    // 极远处才隐藏
    else {
      return 0; // 不显示信息
    }
  };
  
  // 存储可视范围内的星点及其LOD级别
  const [visibleStars, setVisibleStars] = useState<Array<{star: StarPoint, lod: number}>>([]);
  
  // 存储可视星点数据的状态
  const [visibleStarData, setVisibleStarData] = useState<{
    indices: number[];
    positions: Float32Array;
    colors: Float32Array;
  }>({
    indices: [],
    positions: new Float32Array(0),
    colors: new Float32Array(0)
  });

  // 每帧检测鼠标与星点的交互，以及可视范围内的星点
  useFrame(() => {
    // 键盘控制摄像机移动
    updateCameraPosition();
    
    // 相机飞行更新
    updateCameraFlight();

    // 生成可视星点数据 - 在每一帧重新生成，确保与相机位置同步
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
    
    // 更新可视星点数据状态
    setVisibleStarData({
      indices: visibleStarIndices,
      positions,
      colors
    });
    
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
          // 使用当前帧生成的visibleStarIndices数组
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
  
  // 如果没有可视星点，只渲染必要元素
  if (visibleStarData.indices.length === 0) {
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
            const star = allStars[visibleStarData.indices[index]];
            if (star && !star.id.startsWith('far-star-')) { // 只处理实际星点
              onStarClick(star);
            }
          }
        }}
      >
        <bufferGeometry>
          <bufferAttribute args={[visibleStarData.positions, 3]} name="position" count={visibleStarData.indices.length} />
          <bufferAttribute args={[visibleStarData.colors, 3]} name="color" count={visibleStarData.indices.length} />
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
          <bufferAttribute args={[visibleStarData.positions, 3]} name="position" count={visibleStarData.indices.length} />
          <bufferAttribute args={[visibleStarData.colors, 3]} name="color" count={visibleStarData.indices.length} />
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
          <bufferAttribute args={[visibleStarData.positions, 3]} name="position" count={visibleStarData.indices.length} />
          <bufferAttribute args={[visibleStarData.colors, 3]} name="color" count={visibleStarData.indices.length} />
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
      
      {/* 卡片之间的连线 */}
      {visibleStars.length > 1 && (
        <group>
          {/* 创建连线几何 */}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute 
                args={[
                  new Float32Array(
                    visibleStars.flatMap(({ star: starA }) => {
                      // 获取当前星点的相关星点
                      return (starA.relatedStars || []).flatMap(relatedStar => {
                        // 查找相关星点在可视星点列表中的位置
                        const starB = visibleStars.find(({ star }) => star.id === relatedStar.id);
                        if (starB) {
                          // 为每对相关星点创建一条连线
                          return [
                            starA.position.x, starA.position.y, starA.position.z,
                            starB.star.position.x, starB.star.position.y, starB.star.position.z
                          ];
                        }
                        return [];
                      });
                    })
                  ),
                  3
                ]} 
                name="position" 
              />
              <bufferAttribute 
                args={[
                  new Float32Array(
                    visibleStars.flatMap(({ star: starA, lod: lodA }) => {
                      // 获取当前星点的相关星点
                      return (starA.relatedStars || []).flatMap(relatedStar => {
                        // 查找相关星点在可视星点列表中的位置
                        const starB = visibleStars.find(({ star }) => star.id === relatedStar.id);
                        if (starB) {
                          // 根据星点尺寸组合设置连线颜色
                        let color;
                        if (lodA === 3 && starB.lod === 3) {
                          // 大卡片之间 - 蓝色
                          color = [0.4, 0.8, 1.0]; // 蓝色
                        } else if (lodA === 3 && starB.lod === 2 || lodA === 2 && starB.lod === 3) {
                          // 大卡片与中等卡片之间 - 青色
                          color = [0.4, 1.0, 0.8]; // 青色
                        } else if (lodA === 3 && starB.lod === 1 || lodA === 1 && starB.lod === 3) {
                          // 大卡片与小卡片之间 - 紫色
                          color = [0.8, 0.4, 1.0]; // 紫色
                        } else if (lodA === 2 && starB.lod === 2) {
                          // 中等卡片之间 - 绿色
                          color = [0.4, 1.0, 0.6]; // 绿色
                        } else if (lodA === 2 && starB.lod === 1 || lodA === 1 && starB.lod === 2) {
                          // 中等卡片与小卡片之间 - 橙色
                          color = [1.0, 0.7, 0.4]; // 橙色
                        } else {
                          // 小卡片之间 - 黄色
                          color = [1.0, 0.9, 0.4]; // 黄色
                        }
                          return [...color, ...color]; // 为连线的两个端点设置相同颜色
                        }
                        return [];
                      });
                    })
                  ),
                  3
                ]} 
                name="color" 
              />
            </bufferGeometry>
            <lineBasicMaterial 
              vertexColors={true} 
              linewidth={2} 
              transparent={true} 
              opacity={0.6}
            />
          </lineSegments>
        </group>
      )}
      
      {/* 星点悬停预览 */}
      <StarHoverPreview hoveredStar={hoveredStar} mouse={mouse} />
      
      {/* 可视范围内星点的LOD分级信息卡片 */}
      <VisibleStarInfoCards visibleStars={visibleStars} />
    </group>
  );
};
