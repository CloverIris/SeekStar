import { useRef, useEffect } from 'react';
import * as THREE from 'three';

export const useCameraFlight = ({
  isFlying,
  targetPosition,
  targetLookAt,
  camera,
  onFlightComplete
}: {
  isFlying: boolean;
  targetPosition: THREE.Vector3 | null;
  targetLookAt: THREE.Vector3 | null;
  camera: THREE.Camera;
  onFlightComplete: () => void;
}) => {
  const startPosition = useRef<THREE.Vector3 | null>(null);
  const startLookAt = useRef<THREE.Vector3 | null>(null);
  const flightDuration = useRef<number>(2.0); // 固定飞行时长（秒）
  const flightStartTime = useRef<number>(0);
  const isInitialized = useRef(false);
  
  // 初始化飞行起点
  useEffect(() => {
    if (isFlying && targetPosition && targetLookAt && !isInitialized.current && camera) {
      startPosition.current = camera.position.clone();
      // 计算初始观察点
      const direction = new THREE.Vector3();
      (camera as THREE.PerspectiveCamera).getWorldDirection(direction);
      startLookAt.current = camera.position.clone().add(direction.multiplyScalar(10));
      // 记录飞行开始时间
      flightStartTime.current = performance.now() / 1000;
      isInitialized.current = true;
    }
  }, [isFlying, camera, targetPosition, targetLookAt]);
  
  // 重置初始化状态
  useEffect(() => {
    if (!isFlying) {
      isInitialized.current = false;
    }
  }, [isFlying]);
  
  // 执行相机飞行
  const updateCameraFlight = () => {
    if (!isFlying || !targetPosition || !targetLookAt || !startPosition.current || !startLookAt.current || !camera) {
      return;
    }
    
    // 计算飞行时间（秒）
    const currentTime = performance.now() / 1000;
    const elapsedTime = currentTime - flightStartTime.current;
    
    // 计算飞行进度（0-1）
    const progress = Math.min(elapsedTime / flightDuration.current, 1);
    
    // 使用更自然的缓动函数（ease-in-out-sine）
    const easeProgress = 0.5 * (1 - Math.cos(Math.PI * progress));
    
    // 更平滑的缓动函数，带有加速和减速效果
    const smoothProgress = 1 - Math.pow(1 - easeProgress, 3);
    
    // 更新相机位置
    camera.position.lerpVectors(startPosition.current, targetPosition, smoothProgress);
    
    // 更新相机朝向
    const newLookAt = new THREE.Vector3();
    newLookAt.lerpVectors(startLookAt.current, targetLookAt, smoothProgress);
    (camera as THREE.PerspectiveCamera).lookAt(newLookAt);
    
    // 飞行结束
    if (progress >= 1) {
      onFlightComplete();
    }
  };
  
  return {
    updateCameraFlight
  };
};
