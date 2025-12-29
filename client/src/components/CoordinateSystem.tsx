import { useRef } from 'react';
import * as THREE from 'three';

interface CoordinateSystemProps {
  size?: number;
  // axisWidth?: number; // 移除未使用的参数
  showLabels?: boolean;
}

export const CoordinateSystem = ({ 
  size = 20, 
  // axisWidth = 2, // 移除未使用的参数
  showLabels = true 
}: CoordinateSystemProps) => {
  // 移除未使用的camera变量
  // const { camera } = useThree();
  const axisGroupRef = useRef<THREE.Group | null>(null);

  // 创建坐标轴
  const createAxes = () => {
    // 轴的材质
    const materials = [
      new THREE.LineBasicMaterial({ color: 0xff0000 }), // X轴 - 红色
      new THREE.LineBasicMaterial({ color: 0x00ff00 }), // Y轴 - 绿色
      new THREE.LineBasicMaterial({ color: 0x0000ff })  // Z轴 - 蓝色
    ];

    // 轴的几何形状
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      // X轴
      0, 0, 0, size, 0, 0,
      // Y轴
      0, 0, 0, 0, size, 0,
      // Z轴
      0, 0, 0, 0, 0, size
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 创建三条线
    const lines = [];
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Line(geometry, materials[i]);
      lines.push(line);
    }

    return lines;
  };

  // 创建刻度
  const createTicks = () => {
    const ticks = [];
    const tickSize = size / 10;
    const tickColor = 0xffffff;

    // 刻度材质
    const material = new THREE.LineBasicMaterial({ 
      color: tickColor, 
      linewidth: 1 
    });

    // 为每个轴创建刻度
    for (let axis = 0; axis < 3; axis++) {
      for (let i = 1; i <= 10; i++) {
        const tickGeometry = new THREE.BufferGeometry();
        const tickPosition = (size / 10) * i;
        
        let positions;
        if (axis === 0) {
          // X轴刻度
          positions = new Float32Array([
            tickPosition, -tickSize/2, 0, 
            tickPosition, tickSize/2, 0,
            tickPosition, 0, -tickSize/2,
            tickPosition, 0, tickSize/2
          ]);
        } else if (axis === 1) {
          // Y轴刻度
          positions = new Float32Array([
            -tickSize/2, tickPosition, 0, 
            tickSize/2, tickPosition, 0,
            0, tickPosition, -tickSize/2,
            0, tickPosition, tickSize/2
          ]);
        } else {
          // Z轴刻度
          positions = new Float32Array([
            -tickSize/2, 0, tickPosition, 
            tickSize/2, 0, tickPosition,
            0, -tickSize/2, tickPosition,
            0, tickSize/2, tickPosition
          ]);
        }
        
        tickGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const tick = new THREE.LineSegments(tickGeometry, material);
        ticks.push(tick);
      }
    }

    return ticks;
  };

  // 创建箭头
  const createArrows = () => {
    const arrows = [];
    const arrowLength = size / 10;
    
    // 箭头材质
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000 }), // X轴 - 红色
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // Y轴 - 绿色
      new THREE.MeshBasicMaterial({ color: 0x0000ff })  // Z轴 - 蓝色
    ];

    // 箭头几何形状
    const arrowGeometry = new THREE.ConeGeometry(arrowLength/3, arrowLength, 4);

    // 为每个轴创建箭头
    for (let axis = 0; axis < 3; axis++) {
      const arrow = new THREE.Mesh(arrowGeometry, materials[axis]);
      
      if (axis === 0) {
        // X轴箭头
        arrow.position.set(size, 0, 0);
        arrow.rotation.set(0, 0, Math.PI / 2);
      } else if (axis === 1) {
        // Y轴箭头
        arrow.position.set(0, size, 0);
        arrow.rotation.set(Math.PI / 2, 0, 0);
      } else {
        // Z轴箭头
        arrow.position.set(0, 0, size);
      }
      
      arrows.push(arrow);
    }

    return arrows;
  };

  return (
    <group ref={axisGroupRef}>
      {/* 坐标轴 */}
      {createAxes().map((line, index) => (
        <primitive key={`axis-${index}`} object={line} />
      ))}

      {/* 刻度 */}
      {createTicks().map((tick, index) => (
        <primitive key={`tick-${index}`} object={tick} />
      ))}

      {/* 箭头 */}
      {createArrows().map((arrow, index) => (
        <primitive key={`arrow-${index}`} object={arrow} />
      ))}

      {/* 标签 */}
      {showLabels && (
        <>
          {/* 使用圆锥几何体代替文本标签，更简单高效 */}
          {/* X轴标签 */}
          <mesh position={[size + 1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.5, 1, 4]} />
            <meshBasicMaterial color={0xff0000} />
          </mesh>
          {/* Y轴标签 */}
          <mesh position={[0, size + 1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.5, 1, 4]} />
            <meshBasicMaterial color={0x00ff00} />
          </mesh>
          {/* Z轴标签 */}
          <mesh position={[0, 0, size + 1]}>
            <coneGeometry args={[0.5, 1, 4]} />
            <meshBasicMaterial color={0x0000ff} />
          </mesh>
        </>
      )}
    </group>
  );
};
