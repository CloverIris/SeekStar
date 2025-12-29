import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { StarPoint } from '../types';

interface VisibleStarInfoCardsProps {
  visibleStars: Array<{ star: StarPoint; lod: number }>;
}

// 基于星点ID生成稳定的偏移值
const getStableOffset = (id: string): [number, number] => {
  // 使用简单的哈希算法生成稳定的偏移值
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // 将哈希值映射到 -0.5 到 0.5 之间
  const offsetX = ((hash & 0xFF) / 255) - 0.5;
  const offsetY = (((hash >> 8) & 0xFF) / 255) - 0.5;
  
  return [offsetX, offsetY];
};

export const VisibleStarInfoCards = ({ visibleStars }: VisibleStarInfoCardsProps) => {
  const { camera } = useThree();
  
  if (!visibleStars || visibleStars.length === 0) return null;
  
  // visibleStars已经是经过筛选的可视星点，无需再次检查
  const visibleInFrustum = visibleStars;
  
  return (
    <>
      {visibleInFrustum.map(({ star, lod }) => {
        if (!star || !star.position) return null;
        
        // 计算卡片缩放比例 - 基于3D CG软件工作区思路
        // 距离越近，缩放比例越大，允许更大的缩放
        const starPosition = new THREE.Vector3(
          star.position.x,
          star.position.y,
          star.position.z
        );
        const distance = camera.position.distanceTo(starPosition);
        
        // 允许更大的缩放范围，最小0.2，最大10倍
        // 3D CG软件工作区思路：近距离时可以无限放大查看细节
        const scale = Math.max(0.2, 1 / (distance * 0.08));
        
        // 计算圆角大小 - 距离越近，圆角越小
        const borderRadius = `${Math.max(8, 36 - (distance * 1.5))}px`;
        
        // 固定透明度为1，去掉距离导致的透明度变化
        const opacity = 1;
        
        // 根据LOD级别选择要显示的信息模板
        let cardContent;
        let cardClass = 'star-info-card';
        
        if (lod === 3) {
          // LOD级别3：显示完整信息 - 卡片形式
          cardClass = 'star-info-card lod-3 full-card';
          cardContent = (
            <div className="card-content" style={{
              padding: '20px',
              position: 'relative',
              zIndex: 2,
            }}>
              <div className="card-header" style={{
                marginBottom: '16px',
              }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '700',
                  color: '#ffffff',
                  lineHeight: '1.3',
                  marginBottom: '12px',
                }}>{star.title || '未命名'}</h4>
                <div className="card-meta" style={{
                  display: 'flex',
                  gap: '16px',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.75)',
                  flexWrap: 'wrap',
                }}>
                  {star.author && star.author.length > 0 && (
                    <span className="star-author" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <span style={{ fontSize: '16px' }}>👤</span>
                      {star.author.join(', ')}
                    </span>
                  )}
                  {star.source && (
                    <span className="star-source" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <span style={{ fontSize: '16px' }}>🌐</span>
                      {star.source}
                    </span>
                  )}
                  {star.publishDate && (
                    <span className="star-date" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <span style={{ fontSize: '16px' }}>📅</span>
                      {new Date(star.publishDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {star.url && (
                  <a 
                    href={star.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#4ECDC4',
                      textDecoration: 'none',
                      marginTop: '8px',
                      transition: 'color 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = '#FFD166';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = '#4ECDC4';
                    }}
                  >
                    <span>🔗</span>
                    {star.url.length > 50 ? `${star.url.slice(0, 50)}...` : star.url}
                  </a>
                )}
              </div>
              <div className="card-body" style={{
                marginBottom: '16px',
              }}>
                <p className="star-content" style={{
                  margin: 0,
                  fontSize: '15px',
                  lineHeight: '1.7',
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '16px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 5,
                  WebkitBoxOrient: 'vertical',
                }}>{star.content || star.summary || '无内容'}</p>
                {star.tags && star.tags.length > 0 && (
                  <div className="star-tags" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    {star.tags.map((tag, index) => (
                      <span key={index} className="star-tag" style={{
                        padding: '6px 14px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(78, 205, 196, 0.2)',
                        color: '#4ECDC4',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                      }}>{tag || ''}</span>
                    ))}
                  </div>
                )}
              </div>
              {star.imageUrl && (
                <div className="star-image" style={{
                  marginTop: '16px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  <img 
                    src={star.imageUrl} 
                    alt={star.title} 
                    style={{
                      width: '100%',
                      height: '180px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              )}
            </div>
          );
        } else if (lod === 2) {
          // LOD级别2：显示标题和作者 - 简化卡片（无背景）
          cardClass = 'star-info-card lod-2 simple-card';
          cardContent = (
            <div className="card-content" style={{
              padding: '0',
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
            }}>
              <div className="card-header" style={{
                textAlign: 'center',
              }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#ffffff',
                  lineHeight: '1.4',
                  marginBottom: '6px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  textShadow: '0 0 8px rgba(0, 0, 0, 0.8)',
                }}>{star.title || '未命名'}</h4>
                <span className="star-author" style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textShadow: '0 0 8px rgba(0, 0, 0, 0.8)',
                }}>
                  <span style={{ fontSize: '14px' }}>👤</span>
                  {(star.author || []).join(', ') || '未知'}
                </span>
              </div>
            </div>
          );
        } else {
          // LOD级别1：只显示标题 - 最小卡片（无背景）
          cardClass = 'star-info-card lod-1 minimal-card';
          cardContent = (
            <div className="card-content" style={{
              padding: '0',
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
            }}>
              <h4 className="star-title-minimal" style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '600',
                color: '#ffffff',
                textAlign: 'center',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                textShadow: '0 0 8px rgba(0, 0, 0, 0.8)',
              }}>{star.title || '未命名'}</h4>
            </div>
          );
        }
      
        // 为卡片添加基于ID的稳定偏移，防止堆叠且避免抽搐
        const [offsetX, offsetY] = getStableOffset(star.id);
        
        return (
          <Html 
            key={star.id} 
            className="star-info-card-container"
            position={[
              star.position.x + offsetX,
              star.position.y + offsetY,
              star.position.z
            ] as [number, number, number]}
            style={{
              transform: `translate(-50%, -100%) scale(${scale})`, // 居中对齐星点并应用缩放
              opacity: opacity,
              pointerEvents: 'auto', // 允许鼠标事件
              zIndex: 5, // 降低z-index，确保UI控制元素在前面
              transition: 'transform 0.4s cubic-bezier(0.3, 0, 0.2, 1), opacity 0.4s ease',
              perspective: '1000px', // 添加3D透视效果
            }}
            onPointerEnter={(e) => {
              // 鼠标悬停时放大卡片并添加轻微旋转效果
              const target = e.currentTarget as HTMLElement;
              if (target) {
                target.style.transform = `translate(-50%, -100%) scale(${scale * 1.4}) rotateY(5deg) rotateX(3deg)`;
                if (lod === 3) {
                  target.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
                }
              }
            }}
            onPointerLeave={(e) => {
              // 鼠标离开时恢复原大小和位置
              const target = e.currentTarget as HTMLElement;
              if (target) {
                target.style.transform = `translate(-50%, -100%) scale(${scale}) rotateY(0deg) rotateX(0deg)`;
                if (lod === 3) {
                  target.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.2)';
                }
              }
            }}
          >
            <div className={cardClass} style={{
              borderRadius: borderRadius,
              opacity: opacity,
              // 移除重复的缩放，避免冲突
              transition: 'all 0.4s cubic-bezier(0.3, 0, 0.2, 1)',
              backgroundColor: lod === 3 ? 'rgba(20, 25, 40, 0.95)' : 'transparent', // 仅大卡片有背景
              backdropFilter: lod === 3 ? 'blur(10px)' : 'none', // 仅大卡片有模糊效果
              border: lod === 3 ? '1px solid rgba(255, 255, 255, 0.15)' : 'none', // 仅大卡片有边框
              boxShadow: lod === 3 ? '0 10px 20px rgba(0, 0, 0, 0.25)' : 'none', // 仅大卡片有阴影
              overflow: 'hidden',
              maxWidth: lod === 3 ? '500px' : '300px', // 根据LOD调整最大宽度
              width: lod === 3 ? '480px' : 'auto', // 根据LOD调整宽度
            }}>
              {/* 卡片渐变顶部装饰 - 仅大卡片显示 */}
              {lod === 3 && (
                <div style={{
                  height: '4px',
                  width: '100%',
                  background: 'linear-gradient(90deg, #4ECDC4, #FF6B6B, #FFD166)',
                  transition: 'all 0.4s ease',
                }}></div>
              )}
              
              {cardContent}
              
              {/* 卡片发光效果 - 仅大卡片显示 */}
              {lod === 3 && (
                <div className="card-glow" style={{
                  borderRadius: borderRadius,
                  opacity: opacity * 0.5,
                  background: 'radial-gradient(circle at center, rgba(78, 205, 196, 0.3), transparent 70%)',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  transition: 'opacity 0.4s ease',
                }}></div>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
};
