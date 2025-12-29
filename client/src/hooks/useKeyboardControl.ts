import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const useKeyboardControl = () => {
  const { camera, gl } = useThree();
  const keysPressed = useRef<Set<string>>(new Set());
  const moveDirection = useRef(new THREE.Vector3());
  const prevMousePos = useRef({ x: 0, y: 0 });
  const mouseButtons = useRef({ left: false, middle: false, right: false });
  
  // 添加平滑旋转的阻尼效果
  const rotationSmoothFactor = 0.1;
  const targetRotation = useRef(new THREE.Quaternion());
  const currentRotation = useRef(new THREE.Quaternion());
  targetRotation.current.copy(camera.quaternion);
  currentRotation.current.copy(camera.quaternion);
  
  // 初始化键盘和鼠标事件监听器
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e && e.key) {
        keysPressed.current.add(e.key.toLowerCase());
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e && e.key) {
        keysPressed.current.delete(e.key.toLowerCase());
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      // 滚轮控制相机前进/后退
      const zoomSpeed = 0.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      camera.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(direction * zoomSpeed));
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      // 记录鼠标按下状态
      if (e.button === 0) mouseButtons.current.left = true;
      if (e.button === 1) mouseButtons.current.middle = true;
      if (e.button === 2) mouseButtons.current.right = true;
      
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // 记录鼠标释放状态
      if (e.button === 0) mouseButtons.current.left = false;
      if (e.button === 1) mouseButtons.current.middle = false;
      if (e.button === 2) mouseButtons.current.right = false;
      
      // 立即重置鼠标位置，防止粘滞
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      // 只有在鼠标按钮按下时才处理移动
      if (!mouseButtons.current.left && !mouseButtons.current.middle && !mouseButtons.current.right) {
        // 更新鼠标位置，但不处理移动
        prevMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }
      
      const deltaX = e.clientX - prevMousePos.current.x;
      const deltaY = e.clientY - prevMousePos.current.y;
      
      // 自由相机控制
      if (mouseButtons.current.left) {
        // 左键：旋转视角 - 优化灵敏度和流畅度
        const sensitivity = 0.0015; // 降低灵敏度，使旋转更精细
        
        // 获取相机的前向和右向向量
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        right.crossVectors(forward, up).normalize();
        
        // 计算旋转轴和角度
        const rotationAxis = new THREE.Vector3();
        rotationAxis.crossVectors(
          right.multiplyScalar(deltaX),
          up.multiplyScalar(-deltaY) // 反转Y轴旋转方向，使操作更直观
        ).normalize();
        
        const rotationAngle = Math.sqrt(deltaX * deltaX + deltaY * deltaY) * sensitivity;
        
        // 旋转相机 - 使用平滑旋转
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(rotationAxis, rotationAngle);
        targetRotation.current.multiply(quaternion);
        camera.quaternion.slerp(targetRotation.current, rotationSmoothFactor);
        
      } else if (mouseButtons.current.middle) {
        // 中键：平移视角 - 优化灵敏度
        const panSpeed = 0.015; // 调整平移速度，使操作更流畅
        
        // 获取相机的前向和右向向量
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        right.crossVectors(forward, up).normalize();
        
        // 平移相机
        const panDistance = new THREE.Vector3(
          -deltaX * panSpeed,
          deltaY * panSpeed,
          0
        );
        
        // 应用平移，使用更平滑的方式
        camera.position.add(panDistance.applyMatrix4(camera.matrix));
        
      } else if (mouseButtons.current.right) {
        // 右键：缩放视角 - 优化灵敏度
        const zoomSpeed = 0.0015; // 调整缩放速度
        const zoomDistance = deltaY * zoomSpeed;
        
        // 应用缩放，使用更平滑的方式
        const zoomVector = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(zoomDistance);
        camera.position.add(zoomVector);
      }
      
      // 更新鼠标位置
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };
    
    // 处理窗口失焦事件，重置所有按键和鼠标状态
    const handleWindowBlur = () => {
      keysPressed.current.clear();
      mouseButtons.current.left = false;
      mouseButtons.current.middle = false;
      mouseButtons.current.right = false;
    };
    
    // 禁用右键菜单
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    // 添加事件监听器
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('blur', handleWindowBlur); // 添加窗口失焦事件
    gl.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      // 移除事件监听器
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('blur', handleWindowBlur); // 移除窗口失焦事件
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl]);
  
  // 相机移动控制 - 键盘WASD控制
  const updateCameraPosition = () => {
    // 调整基础速度，使其更适合长时间使用
    const baseSpeed = 0.2;
    const speed = baseSpeed;
    moveDirection.current.set(0, 0, 0);
    
    // 获取相机的前向和右向向量
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    
    camera.getWorldDirection(forward);
    forward.normalize(); // 允许在任意方向移动，包括上下
    
    right.crossVectors(forward, up).normalize();
    
    // WASD控制前后左右
    if (keysPressed.current.has('w')) {
      moveDirection.current.add(forward.multiplyScalar(speed)); // 前进
    }
    if (keysPressed.current.has('s')) {
      moveDirection.current.sub(forward.multiplyScalar(speed)); // 后退
    }
    if (keysPressed.current.has('a')) {
      moveDirection.current.sub(right.multiplyScalar(speed)); // 向左
    }
    if (keysPressed.current.has('d')) {
      moveDirection.current.add(right.multiplyScalar(speed)); // 向右
    }
    
    // Shift/Ctrl控制上下 - 调整上下移动速度，使其更协调
    const verticalSpeed = speed * 0.8; // 上下移动速度稍慢，更自然
    if (keysPressed.current.has('shift')) {
      moveDirection.current.y += verticalSpeed; // 向上
    }
    if (keysPressed.current.has('control')) {
      moveDirection.current.y -= verticalSpeed; // 向下
    }
    
    // 应用移动到相机 - 使用平滑移动
    camera.position.add(moveDirection.current);
  };
  
  return {
    keysPressed: keysPressed.current,
    updateCameraPosition
  };
};
