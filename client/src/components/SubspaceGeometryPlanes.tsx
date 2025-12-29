import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SubspaceGeometryPlanesProps {
  size: number;
  gridSize: number;
  planeOpacity: number;
}

export const SubspaceGeometryPlanes = ({
  size = 50,
  gridSize = 50,
  planeOpacity = 0.2
}: SubspaceGeometryPlanesProps) => {
  const { camera } = useThree();
  // 移除ref，因为primitive组件的ref用法不正确导致了错误
  // const planeRefs = useRef<{
  //   xy: THREE.Mesh | null;
  //   xz: THREE.Mesh | null;
  //   yz: THREE.Mesh | null;
  // }>({ xy: null, xz: null, yz: null });

  // 网格线材质
  const gridMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x64C8FF),
    opacity: 0.4,
    transparent: true
  });

  // 平面材质
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x64C8FF),
    opacity: planeOpacity,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  // 轴材质
  const axisMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x64C8FF),
    opacity: 0.8,
    transparent: true
  });

  // 创建网格
  const createGrid = (size: number, divisions: number, rotation: THREE.Vector3) => {
    const gridHelper = new THREE.GridHelper(size, divisions, 0x64C8FF, 0x64C8FF);
    gridHelper.material = gridMaterial;
    gridHelper.rotation.set(rotation.x, rotation.y, rotation.z);
    gridHelper.position.set(0, 0, 0);
    return gridHelper;
  };

  // 创建平面
  const createPlane = (size: number, rotation: THREE.Vector3) => {
    const geometry = new THREE.PlaneGeometry(size, size);
    const mesh = new THREE.Mesh(geometry, planeMaterial);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.position.set(0, 0, 0);
    mesh.renderOrder = -1;
    return mesh;
  };

  // 创建坐标轴
  const createAxis = (length: number, position: THREE.Vector3, direction: THREE.Vector3) => {
    const points = [
      new THREE.Vector3(position.x, position.y, position.z),
      new THREE.Vector3(
        position.x + direction.x * length,
        position.y + direction.y * length,
        position.z + direction.z * length
      )
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(geometry, axisMaterial);
  };

  // 创建轴指示器
  const createAxisIndicator = (axis: 'x' | 'y' | 'z') => {
    const size = 2;
    let geometry, color;
    
    switch (axis) {
      case 'x':
        geometry = new THREE.BoxGeometry(size, 0.2, 0.2);
        color = new THREE.Color(0xFF6B6B);
        break;
      case 'y':
        geometry = new THREE.BoxGeometry(0.2, size, 0.2);
        color = new THREE.Color(0x4ECDC4);
        break;
      case 'z':
        geometry = new THREE.BoxGeometry(0.2, 0.2, size);
        color = new THREE.Color(0x45B7D1);
        break;
    }
    
    const material = new THREE.MeshBasicMaterial({
      color,
      opacity: 0.8,
      transparent: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // 调整位置，使指示器位于轴的末端
    switch (axis) {
      case 'x':
        mesh.position.set(size / 2, 0, 0);
        break;
      case 'y':
        mesh.position.set(0, size / 2, 0);
        break;
      case 'z':
        mesh.position.set(0, 0, size / 2);
        break;
    }
    
    return mesh;
  };

  // 每帧更新平面可见性和透明度，根据相机位置动态调整
  useFrame(() => {
    const distance = camera.position.length();
    const opacity = Math.max(0.1, planeOpacity * (1 - distance / (size * 2)));
    
    // 更新平面材质透明度
    planeMaterial.opacity = opacity;
    gridMaterial.opacity = opacity * 0.5;
    axisMaterial.opacity = opacity * 0.8;
    
    // 移除基于ref的平面可见性控制，因为ref导致了错误
    // 改为始终显示所有平面，通过透明度控制可见效果
  });

  return (
    <group name="subspace-geometry">
      {/* XY平面 (z=0) */}
      <primitive
        object={createGrid(gridSize, 50, new THREE.Vector3(0, 0, 0))}
      />
      <primitive
        object={createPlane(gridSize, new THREE.Vector3(0, 0, 0))}
      />
      
      {/* XZ平面 (y=0) */}
      <primitive
        object={createGrid(gridSize, 50, new THREE.Vector3(Math.PI / 2, 0, 0))}
      />
      <primitive
        object={createPlane(gridSize, new THREE.Vector3(Math.PI / 2, 0, 0))}
      />
      
      {/* YZ平面 (x=0) */}
      <primitive
        object={createGrid(gridSize, 50, new THREE.Vector3(Math.PI / 2, 0, Math.PI / 2))}
      />
      <primitive
        object={createPlane(gridSize, new THREE.Vector3(Math.PI / 2, 0, Math.PI / 2))}
      />
      
      {/* 坐标轴 */}
      <primitive
        object={createAxis(size, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0))}
      />
      <primitive
        object={createAxis(size, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))}
      />
      <primitive
        object={createAxis(size, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1))}
      />
      
      {/* 轴指示器 */}
      <primitive object={createAxisIndicator('x')} />
      <primitive object={createAxisIndicator('y')} />
      <primitive object={createAxisIndicator('z')} />
    </group>
  );
};
