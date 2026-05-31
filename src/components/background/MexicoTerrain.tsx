'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';

function TerrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(20, 20, 80, 80);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z =
        Math.sin(x * 0.5) * 0.6 +
        Math.cos(y * 0.4) * 0.4 +
        Math.sin(x * 0.8 + y * 0.3) * 0.3 +
        Math.cos(x * 0.2 - y * 0.6) * 0.5;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2.8, 0, 0]}
      position={[0, -3, -2]}
    >
      <meshStandardMaterial
        color="#0D1A3A"
        wireframe
        transparent
        opacity={0.18}
        emissive="#007AFF"
        emissiveIntensity={0.06}
      />
    </mesh>
  );
}

function FloatingOrbs() {
  const orbs = useMemo(() => [
    { pos: [-6, 2, -5] as [number,number,number], color: '#007AFF', radius: 1.2, speed: 0.4 },
    { pos: [5, -1, -8] as [number,number,number],  color: '#00C7BE', radius: 0.8, speed: 0.6 },
    { pos: [0, 3, -12] as [number,number,number],  color: '#5E5CE6', radius: 1.8, speed: 0.25 },
  ], []);

  return (
    <>
      {orbs.map((orb, i) => (
        <OrbMesh key={i} {...orb} index={i} />
      ))}
    </>
  );
}

function OrbMesh({ pos, color, radius, speed, index }: {
  pos: [number,number,number]; color: string; radius: number; speed: number; index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime() * speed + index * 2;
      meshRef.current.position.y = pos[1] + Math.sin(t) * 0.8;
      meshRef.current.position.x = pos[0] + Math.cos(t * 0.7) * 0.4;
    }
  });

  return (
    <mesh ref={meshRef} position={pos}>
      <sphereGeometry args={[radius, 16, 16]} />
      <MeshWobbleMaterial
        color={color}
        transparent
        opacity={0.06}
        factor={0.3}
        speed={speed * 2}
      />
    </mesh>
  );
}

export function MexicoTerrain() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      {/* CSS gradient layer */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(0,122,255,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 70%, rgba(0,199,190,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 50% 10%, rgba(94,92,230,0.10) 0%, transparent 50%),
            linear-gradient(180deg, #080B14 0%, #0A0F1E 50%, #080B14 100%)
          `,
        }}
      />
      {/* WebGL canvas */}
      <Canvas
        camera={{ position: [0, 4, 8], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        style={{ opacity: 0.85 }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[-8, 6, 4]}  color="#007AFF" intensity={0.8} />
        <pointLight position={[8, -2, -4]} color="#00C7BE" intensity={0.5} />
        <TerrainMesh />
        <FloatingOrbs />
      </Canvas>
    </div>
  );
}
