import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { StarPoint } from '../types';

interface VisibleStarInfoCardsProps {
  visibleStars: Array<{ star: StarPoint; lod: number }>;
}

export const VisibleStarInfoCards = ({ visibleStars }: VisibleStarInfoCardsProps) => {
  const { camera } = useThree();
  
  if (!visibleStars || visibleStars.length === 0) return null;
  
  // 创建视锥体，用于检测星点是否在视野内
  const frustum = new THREE.Frustum();
  const projScreenMatrix = new THREE.Matrix4();
  
  // 更新视锥体矩阵
  camera.updateMatrixWorld();
  projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);
  
  // 过滤出视野内的星点
  const visibleInFrustum = visibleStars.filter(({ star }) => {
    if (!star || !star.position) return false;
    
    const starPosition = new THREE.Vector3(
      star.position.x,
      star.position.y,
      star.position.z
    );
    
    // 检查星点是否在视锥体内
    return frustum.containsPoint(starPosition);
  });
  
  return (
    <>
      {visibleInFrustum.map(({ star, lod }) => {
        if (!star || !star.position) return null;
        
        // 计算卡片缩放比例 - 近大远小效果
        const starPosition = new THREE.Vector3(
          star.position.x,
          star.position.y,
          star.position.z
        );
        const distance = camera.position.distanceTo(starPosition);
        // 距离越近，缩放比例越大，范围在0.3到1.5之间
        const scale = Math.max(0.3, Math.min(1.5, 1 / (distance * 0.12)));
        
        // 计算圆角大小 - 距离越近，圆角越小
        const borderRadius = `${Math.max(12, 36 - (distance * 1.5))}px`;
        
        // 计算透明度 - 距离越近，透明度越高
        const opacity = Math.min(1, 1 - (distance * 0.015));
        
        // 根据LOD级别选择要显示的信息模板
        let cardContent;
        let cardClass = 'star-info-card';
        
        if (lod === 3) {
          // LOD级别3：显示完整信息 - 卡片形式
          cardClass = 'star-info-card lod-3 full-card';
          cardContent = (
            <div className="card-content" style={{
              padding: '16px',
              position: 'relative',
              zIndex: 2,
            }}>
              <div className="card-header" style={{
                marginBottom: '12px',
              }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#ffffff',
                  lineHeight: '1.4',
                  marginBottom: '8px',
                }}>{star.title || '未命名'}</h4>
                <div className="card-meta" style={{
                  display: 'flex',
                  gap: '12px',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}>
                  <span className="star-author" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ fontSize: '14px' }}>👤</span>
                    {(star.author || []).join(', ') || '未知'}
                  </span>
                  <span className="star-source" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ fontSize: '14px' }}>🌐</span>
                    {star.source || '未知'}
                  </span>
                </div>
              </div>
              <div className="card-body" style={{
                marginBottom: '12px',
              }}>
                <p className="star-content" style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: 'rgba(255, 255, 255, 0.85)',
                  marginBottom: '12px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>{star.content || '无内容'}</p>
                <div className="star-tags" style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {(star.tags || []).slice(0, 4).map((tag, index) => (
                    <span key={index} className="star-tag" style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      backgroundColor: 'rgba(78, 205, 196, 0.2)',
                      color: '#4ECDC4',
                      fontWeight: '500',
                      transition: 'all 0.3s ease',
                    }}>{tag || ''}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        } else if (lod === 2) {
          // LOD级别2：显示标题和作者 - 简化卡片
          cardClass = 'star-info-card lod-2 simple-card';
          cardContent = (
            <div className="card-content" style={{
              padding: '12px 16px',
              position: 'relative',
              zIndex: 2,
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
                }}>{star.title || '未命名'}</h4>
                <span className="star-author" style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span style={{ fontSize: '14px' }}>👤</span>
                  {(star.author || []).join(', ') || '未知'}
                </span>
              </div>
            </div>
          );
        } else {
          // LOD级别1：只显示标题 - 最小卡片
          cardClass = 'star-info-card lod-1 minimal-card';
          cardContent = (
            <div className="card-content" style={{
              padding: '8px 12px',
              position: 'relative',
              zIndex: 2,
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
              }}>{star.title || '未命名'}</h4>
            </div>
          );
        }
      
        return (
          <Html 
            key={star.id} 
            className="star-info-card-container"
            position={[star.position.x, star.position.y, star.position.z]}
            style={{
              transform: `translate(-50%, -100%) scale(${scale})`, // 居中对齐星点并应用缩放
              opacity: opacity,
              pointerEvents: 'auto', // 允许鼠标事件
              zIndex: 500,
              transition: 'transform 0.4s cubic-bezier(0.3, 0, 0.2, 1), opacity 0.4s ease',
              perspective: '1000px', // 添加3D透视效果
            }}
            onPointerEnter={(e) => {
              // 鼠标悬停时放大卡片并添加轻微旋转效果
              const target = e.currentTarget as HTMLElement;
              if (target) {
                target.style.transform = `translate(-50%, -100%) scale(${scale * 1.4}) rotateY(5deg) rotateX(3deg)`;
                target.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
              }
            }}
            onPointerLeave={(e) => {
              // 鼠标离开时恢复原大小和位置
              const target = e.currentTarget as HTMLElement;
              if (target) {
                target.style.transform = `translate(-50%, -100%) scale(${scale}) rotateY(0deg) rotateX(0deg)`;
                target.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.2)';
              }
            }}
          >
            <div className={cardClass} style={{
              borderRadius: borderRadius,
              opacity: opacity,
              transform: `scale(${scale})`,
              transition: 'all 0.4s cubic-bezier(0.3, 0, 0.2, 1)',
              backgroundColor: 'rgba(20, 25, 40, 0.9)', // 深色半透明背景
              backdropFilter: 'blur(10px)', // 模糊背景效果
              border: '1px solid rgba(255, 255, 255, 0.1)', // 轻微边框
              boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)', // 阴影效果
              overflow: 'hidden',
              maxWidth: '300px',
            }}>
              {/* 卡片渐变顶部装饰 */}
              <div style={{
                height: '4px',
                width: '100%',
                background: 'linear-gradient(90deg, #4ECDC4, #FF6B6B, #FFD166)',
                transition: 'all 0.4s ease',
              }}></div>
              
              {cardContent}
              
              {/* 卡片发光效果 */}
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
            </div>
          </Html>
        );
      })}
    </>
  );
};
