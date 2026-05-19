'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GlobeThreatOverlay } from './globe-threat-overlay';

interface ThreatData {
  lat: number;
  lng: number;
  size: number;
  color: string;
  attackType: string;
  count: number;
  country?: string;
}

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  strokeWidth: number;
}

interface Globe3DFullscreenProps {
  threats: ThreatData[];
  arcs: ArcData[];
  isRefreshing?: boolean;
}

const Globe3D = dynamic(() => import('react-globe.gl'), { ssr: false });

export function Globe3DFullscreen({ threats, arcs, isRefreshing = false }: Globe3DFullscreenProps) {
  const globeRef = useRef<any>();
  const [autoRotate, setAutoRotate] = useState(true);
  const [cameraDistance, setCameraDistance] = useState(400);
  const lastInteractionTime = useRef(Date.now());
  const animationFrameRef = useRef<number>();
  const lastUpdateTime = useRef<number>(0);
  
  const shouldUpdate = useCallback(() => {
    const now = performance.now();
    if (now - lastUpdateTime.current > 16.67) {
      lastUpdateTime.current = now;
      return true;
    }
    return false;
  }, []);

  const getDynamicPointSize = (baseSize: number) => {
    const scaleFactor = Math.max(0.4, Math.min(2.0, cameraDistance / 500));
    return baseSize * scaleFactor;
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getArcAltitude = (distance: number) => {
    const minAlt = 0.02;
    const maxAlt = 0.5;
    const maxDistance = 20000;
    const normalizedDistance = Math.min(distance / maxDistance, 1);
    const heightCurve = Math.pow(normalizedDistance, 1.2);
    return minAlt + (maxAlt - minAlt) * heightCurve;
  };

  // Enhanced for fullscreen - more threats and arcs
  const optimizedThreats = useMemo(() => {
    const limitedThreats = threats.slice(0, 100); // Increased for fullscreen
    // Filter out threats with invalid coordinates
    return limitedThreats
      .filter(threat =>
        threat.lat != null && threat.lng != null &&
        !isNaN(threat.lat) && !isNaN(threat.lng) &&
        isFinite(threat.lat) && isFinite(threat.lng)
      )
      .map((threat, index) => ({
        ...threat,
        id: `threat-${index}`,
        calculatedSize: Math.max(0.4, Math.min(1.5, threat.size || 0.7))
      }));
  }, [threats]);

  const memoizedArcsData = useMemo(() => {
    const limitedArcs = arcs.slice(0, 50); // Increased for fullscreen
    // Filter out arcs with invalid coordinates
    return limitedArcs
      .filter(arc =>
        arc.startLat != null && arc.startLng != null &&
        arc.endLat != null && arc.endLng != null &&
        !isNaN(arc.startLat) && !isNaN(arc.startLng) &&
        !isNaN(arc.endLat) && !isNaN(arc.endLng) &&
        isFinite(arc.startLat) && isFinite(arc.startLng) &&
        isFinite(arc.endLat) && isFinite(arc.endLng)
      )
      .map((arc, index) => ({
        ...arc,
        id: `arc-${index}`,
        distance: calculateDistance(arc.startLat, arc.startLng, arc.endLat, arc.endLng)
      }));
  }, [arcs]);

  const globeSettings = useMemo(() => ({
    autoRotateSpeed: 0.2,
    enableDamping: true,
    dampingFactor: 0.1,
    minDistance: 200,
    maxDistance: 1000,
    enablePan: true,
    pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 2,
    antialias: true,
    shadowMap: true
  }), []);

  useEffect(() => {
    if (globeRef.current) {
      const globe = globeRef.current;
      
      // Wait for globe to be fully initialized
      const initTimeout = setTimeout(() => {
        const controls = globe.controls();
        if (controls) {
          controls.autoRotate = autoRotate;
          controls.autoRotateSpeed = globeSettings.autoRotateSpeed;
          controls.enableDamping = globeSettings.enableDamping;
          controls.dampingFactor = globeSettings.dampingFactor;
          controls.minDistance = globeSettings.minDistance;
          controls.maxDistance = globeSettings.maxDistance;
          controls.enablePan = globeSettings.enablePan;
          
          const renderer = globe.renderer();
          if (renderer) {
            renderer.setPixelRatio(globeSettings.pixelRatio);
            renderer.antialias = globeSettings.antialias;
            renderer.shadowMap.enabled = globeSettings.shadowMap;
          }

          // Center the globe properly
          globe.pointOfView({ lat: 0, lng: 0, altitude: 2.2 });
          
          const updateCameraDistance = () => {
            if (globe.camera()) {
              const distance = globe.camera().position.distanceTo(globe.scene().position);
              setCameraDistance(distance);
            }
            animationFrameRef.current = requestAnimationFrame(updateCameraDistance);
          };
          updateCameraDistance();

          const handleInteractionStart = () => {
            lastInteractionTime.current = Date.now();
            if (autoRotate) {
              setAutoRotate(false);
            }
          };

          const handleInteractionEnd = () => {
            lastInteractionTime.current = Date.now();
          };

          controls.addEventListener('start', handleInteractionStart);
          controls.addEventListener('end', handleInteractionEnd);

          const inactivityInterval = setInterval(() => {
            if (Date.now() - lastInteractionTime.current > 15000 && !autoRotate) {
              setAutoRotate(true);
            }
          }, 1000);

          // Return cleanup function
          return () => {
            clearInterval(inactivityInterval);
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            if (controls) {
              controls.removeEventListener('start', handleInteractionStart);
              controls.removeEventListener('end', handleInteractionEnd);
            }
          };
        }
      }, 1000); // Increased delay for proper initialization

      return () => {
        clearTimeout(initTimeout);
      };
    }
  }, [autoRotate, globeSettings]);

  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = autoRotate;
      }
    }
  }, [autoRotate]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex justify-between items-center flex-shrink-0">
        <h3 className="text-2xl font-semibold text-white">Global Threat Intelligence</h3>
        <div className="flex items-center gap-4">
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <div className="w-4 h-4 border border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Updating...</span>
            </div>
          )}
        </div>
      </div>
      
      <div className={`flex-1 min-h-0 bg-black rounded-lg overflow-hidden border border-gray-700 relative transition-opacity duration-300 flex items-center justify-center ${isRefreshing ? 'opacity-75' : 'opacity-100'}`}>
        <Globe3D
          ref={globeRef}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          showAtmosphere={true}
          atmosphereColor="#4a90e2"
          atmosphereAltitude={0.1}
          
          // Enhanced threat points for fullscreen
          pointsData={optimizedThreats}
          pointAltitude={0.006}
          pointColor="color"
          pointRadius={(d: any) => getDynamicPointSize(d.calculatedSize * 0.7)}
          pointResolution={8}
          pointsMerge={true}
          
          // Enhanced arcs for fullscreen
          arcsData={memoizedArcsData}
          arcColor={(d: any) => d.color}
          arcStroke={(d: any) => Math.max(0.3, (d.strokeWidth || 1) * 0.4)}
          arcDashLength={0.6}
          arcDashGap={0.4}
          arcDashAnimateTime={6000}
          arcAltitude={(d: any) => getArcAltitude(d.distance)}
          arcAltitudeAutoScale={0.3}
          
          // Enhanced tooltips
          pointLabel={(d: any) => `
            <div class="bg-black/95 p-3 rounded-lg text-white text-sm border border-gray-600 max-w-xs">
              <div class="font-semibold text-cyan-400 mb-1">${d.attackType}</div>
              <div class="text-gray-300 mb-1">Threats: <span class="text-white font-medium">${d.count}</span></div>
              ${d.country ? `<div class="text-gray-400 text-xs">${d.country}</div>` : ''}
            </div>
          `}

          enablePointerInteraction={true}
          animateIn={false}
        />
        
        {/* Threat Intelligence Overlay */}
        <GlobeThreatOverlay 
          threats={threats} 
          arcs={arcs} 
          isRefreshing={isRefreshing}
          className="z-10"
          position="left"
        />
      </div>
    </div>
  );
}