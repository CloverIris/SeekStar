import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface AtmosphereBackgroundProps {
  starCount?: number;
  beaconCount?: number;
}

export const AtmosphereBackground: React.FC<AtmosphereBackgroundProps> = ({ 
  starCount = 500,
  beaconCount = 20
}) => {
  const { scene } = useThree();
  
  useEffect(() => {
    // 创建星点数据
    const starVertices = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    
    // 生成随机星点位置和颜色
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      
      // 在-500到500范围内生成随机位置
      starVertices[i3] = (Math.random() - 0.5) * 1000;
      starVertices[i3 + 1] = (Math.random() - 0.5) * 1000;
      starVertices[i3 + 2] = (Math.random() - 0.5) * 1000;
      
      // 生成随机白色系颜色
      const brightness = Math.random() * 0.8 + 0.2;
      starColors[i3] = brightness;
      starColors[i3 + 1] = brightness;
      starColors[i3 + 2] = brightness;
    }
    
    // 创建星点几何体
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starVertices, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    
    // 创建星点材质
    const starMaterial = new THREE.PointsMaterial({
      size: 1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    // 创建星点对象
    const stars = new THREE.Points(starGeometry, starMaterial);
    
    // 确保星点在最底层
    stars.renderOrder = -10;
    scene.add(stars);
    
    // 创建空间参考信标
    const beaconGroup = new THREE.Group();
    
    // 信标颜色数组
    const beaconColors = [
      0xff0000, // 红色
      0x00ff00, // 绿色
      0x0000ff, // 蓝色
      0xffff00, // 黄色
      0xff00ff, // 紫色
      0x00ffff  // 青色
    ];
    
    // 生成空间参考信标
    for (let i = 0; i < beaconCount; i++) {
      // 生成信标位置（均匀分布在空间中）
      const radius = 400;
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI;
      const x = radius * Math.sin(angle2) * Math.cos(angle1);
      const y = radius * Math.sin(angle2) * Math.sin(angle1);
      const z = radius * Math.cos(angle2);
      
      // 选择随机颜色
      const color = beaconColors[i % beaconColors.length];
      
      // 创建信标几何体（使用长方体）
      const beaconGeometry = new THREE.BoxGeometry(2, 2, 2);
      
      // 创建信标材质
      const beaconMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });
      
      // 创建信标网格
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
      beacon.position.set(x, y, z);
      
      // 添加信标到组
      beaconGroup.add(beacon);
    }
    
    // 添加信标组到场景
    beaconGroup.renderOrder = -5;
    scene.add(beaconGroup);
    
    // 创建网格线作为额外的空间参考
    const gridHelper = new THREE.GridHelper(1000, 50, 0x444444, 0x222222);
    gridHelper.position.y = 0;
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    gridHelper.renderOrder = -8;
    scene.add(gridHelper);
    
    // 添加轴线辅助
    const axesHelper = new THREE.AxesHelper(50);
    axesHelper.renderOrder = -8;
    scene.add(axesHelper);
    
    return () => {
      // 清理星点
      scene.remove(stars);
      starGeometry.dispose();
      starMaterial.dispose();
      
      // 清理信标
      scene.remove(beaconGroup);
      beaconGroup.children.forEach(beacon => {
        beacon.geometry.dispose();
        (beacon.material as THREE.Material).dispose();
      });
      
      // 清理网格线和轴线
      scene.remove(gridHelper);
      scene.remove(axesHelper);
      (gridHelper.material as THREE.Material).dispose();
      gridHelper.geometry.dispose();
      axesHelper.geometry.dispose();
      (axesHelper.material as THREE.Material).dispose();
    };
  }, [scene, starCount, beaconCount]);
  
  // 只渲染星点，移除大气效果
  return null;
};
