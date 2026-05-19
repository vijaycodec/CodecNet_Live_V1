'use client';

import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import * as d3 from 'd3';

interface AttackData {
  id: string;
  sourceIp: string;
  sourceLat: number;
  sourceLng: number;
  sourceCountry: string;
  targetIp: string;
  targetLat: number;
  targetLng: number;
  targetCountry: string;
  attackType: string;
  severity: 'minor' | 'major' | 'critical';
  timestamp: Date;
  animationDelay?: number;
}

interface ServerLocation {
  ip: string;
  lat: number;
  lng: number;
  country: string;
}

interface Map2DFullscreenProps {
  attacks: AttackData[];
  isRefreshing?: boolean;
  serverLocations?: ServerLocation[];
}

export function Map2DFullscreen({ attacks, isRefreshing = false, serverLocations = [] }: Map2DFullscreenProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFramesRef = useRef<Set<number>>(new Set());
  const lastRenderTime = useRef<number>(0);
  
  // Memoize server locations to prevent unnecessary recalculations
  const memoizedServerLocations = useMemo(() => {
    return serverLocations.length > 0 
      ? serverLocations.map((server, index) => ({
          lat: server.lat,
          lng: server.lng,
          name: `${server.country}-Server`,
          ip: server.ip,
          id: `server-${server.ip}`
        }))
      : [
          { lat: 37.7749, lng: -122.4194, name: 'SF-Server', ip: '192.168.1.100', id: 'server-sf' },
          { lat: 40.7128, lng: -74.0060, name: 'NY-Server', ip: '192.168.1.101', id: 'server-ny' },
          { lat: 51.5074, lng: -0.1278, name: 'UK-Server', ip: '192.168.1.102', id: 'server-uk' },
        ];
  }, [serverLocations]);

  // Memoize and throttle attack data processing
  const processedAttacks = useMemo(() => {
    const now = performance.now();
    
    if (now - lastRenderTime.current < 16.67) {
      return attacks;
    }
    lastRenderTime.current = now;
    
    const limitedAttacks = attacks.slice(0, 200); // Increased for fullscreen
    
    return limitedAttacks.map((attack, index) => ({
      ...attack,
      id: `attack-${attack.id || index}`,
      animationDelay: index * 30,
    }));
  }, [attacks]);

  const cleanup = useCallback(() => {
    animationFramesRef.current.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    animationFramesRef.current.clear();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Get container dimensions for fullscreen
    const container = svgRef.current.parentElement;
    const width = container?.clientWidth || 1400;
    const height = container?.clientHeight || 800;

    const mainGroup = svg.append("g").attr("class", "main-group");

    const projection = d3.geoNaturalEarth1()
      .scale(width * 0.12) // Scale based on container width
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Enhanced zoom behavior for fullscreen
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 15])
      .translateExtent([[-200, -200], [width + 200, height + 200]])
      .extent([[0, 0], [width, height]])
      .on("start", () => {
        svg.style("cursor", "grabbing");
      })
      .on("zoom", (event) => {
        mainGroup.attr("transform", event.transform);
      })
      .on("end", () => {
        svg.style("cursor", "grab");
      });

    svg.call(zoom).style("cursor", "grab");

    // Enhanced zoom controls
    const zoomControls = svg.append("g")
      .attr("class", "zoom-controls")
      .attr("transform", "translate(20, 20)");

    // Zoom in button
    const zoomInBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .style("cursor", "pointer");

    zoomInBtn.append("rect")
      .attr("width", 40)
      .attr("height", 40)
      .attr("fill", "#1f2937")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1)
      .attr("rx", 6);

    zoomInBtn.append("text")
      .attr("x", 20)
      .attr("y", 26)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", "20px")
      .attr("font-weight", "bold")
      .attr("fill", "#e5e7eb")
      .text("+");

    zoomInBtn.on("click", () => {
      svg.transition().duration(300).call(zoom.scaleBy, 1.5);
    });

    // Zoom out button
    const zoomOutBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .attr("transform", "translate(0, 50)")
      .style("cursor", "pointer");

    zoomOutBtn.append("rect")
      .attr("width", 40)
      .attr("height", 40)
      .attr("fill", "#1f2937")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1)
      .attr("rx", 6);

    zoomOutBtn.append("text")
      .attr("x", 20)
      .attr("y", 26)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", "20px")
      .attr("font-weight", "bold")
      .attr("fill", "#e5e7eb")
      .text("−");

    zoomOutBtn.on("click", () => {
      svg.transition().duration(300).call(zoom.scaleBy, 0.67);
    });

    // Reset button
    const resetBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .attr("transform", "translate(0, 100)")
      .style("cursor", "pointer");

    resetBtn.append("rect")
      .attr("width", 40)
      .attr("height", 40)
      .attr("fill", "#1f2937")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1)
      .attr("rx", 6);

    resetBtn.append("text")
      .attr("x", 20)
      .attr("y", 26)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .attr("fill", "#e5e7eb")
      .text("⌂");

    resetBtn.on("click", () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    // Create filters
    const defs = svg.append("defs");
    
    const glowFilter = defs.append("filter")
      .attr("id", "glow-fullscreen")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    glowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");
    
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Load and render world map
    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then((world: any) => {
        // Background
        mainGroup.append("rect")
          .attr("width", width)
          .attr("height", height)
          .attr("fill", "#000000");

        // Countries
        mainGroup.append("g")
          .selectAll("path")
          .data(world.features)
          .enter()
          .append("path")
          .attr("d", path as any)
          .attr("fill", "#d2d2d2")
          .attr("stroke", "#a7a7a7")
          .attr("stroke-width", 0.5);

        const attackGroup = mainGroup.append("g").attr("class", "attacks");

        // Enhanced attack visualization for fullscreen
        processedAttacks.forEach((attack, index) => {
          // Validate coordinates before projection
          if (!attack.sourceLat || !attack.sourceLng || !attack.targetLat || !attack.targetLng ||
              isNaN(attack.sourceLat) || isNaN(attack.sourceLng) || isNaN(attack.targetLat) || isNaN(attack.targetLng)) {
            return;
          }

          const source = projection([attack.sourceLng, attack.sourceLat]);
          const target = projection([attack.targetLng, attack.targetLat]);

          // Validate projected coordinates
          if (!source || !target || isNaN(source[0]) || isNaN(source[1]) || isNaN(target[0]) || isNaN(target[1])) return;

          // Attack dot
          attackGroup.append("circle")
            .attr("class", "attack-dot")
            .attr("cx", source[0])
            .attr("cy", source[1])
            .attr("r", 4) // Larger for fullscreen
            .attr("fill", "#ff4444")
            .attr("opacity", 0)
            .style("filter", "url(#glow-fullscreen)")
            .transition()
            .delay(attack.animationDelay || 0)
            .duration(300)
            .attr("opacity", 1);

          // Attack line
          attackGroup.append("line")
            .attr("class", "attack-line")
            .attr("x1", source[0])
            .attr("y1", source[1])
            .attr("x2", target[0])
            .attr("y2", target[1])
            .attr("stroke", "#00d7d7")
            .attr("stroke-width", 2)
            .attr("opacity", 0)
            .attr("stroke-dasharray", "5,5")
            .style("filter", "url(#glow-fullscreen)")
            .transition()
            .delay((attack.animationDelay || 0) + 200)
            .duration(500)
            .attr("opacity", 0.7);

          // Moving pulse
          const pulse = attackGroup.append("circle")
            .attr("class", "moving-pulse")
            .attr("r", 3)
            .attr("fill", "#ff4444")
            .attr("cx", source[0])
            .attr("cy", source[1])
            .attr("opacity", 0)
            .style("filter", "url(#glow-fullscreen)");

          const animatePulse = () => {
            pulse
              .attr("cx", source[0])
              .attr("cy", source[1])
              .attr("opacity", 0.9);
            
            pulse
              .transition()
              .duration(2000)
              .ease(d3.easeLinear)
              .attr("cx", target[0])
              .attr("cy", target[1])
              .attr("opacity", 0.2)
              .on("end", () => {
                setTimeout(() => animatePulse(), 1000);
              });
          };

          setTimeout(() => animatePulse(), (attack.animationDelay || 0) + 1000);
        });

        // Enhanced server visualization
        const serverGroup = attackGroup.append("g").attr("class", "servers");
        
        memoizedServerLocations.forEach(server => {
          // Validate server coordinates
          if (!server.lat || !server.lng || isNaN(server.lat) || isNaN(server.lng)) {
            return;
          }

          const coords = projection([server.lng, server.lat]);

          // Validate projected coordinates
          if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

          const serverEl = serverGroup.append("g")
            .attr("class", "server")
            .attr("transform", `translate(${coords[0]}, ${coords[1]})`);

          serverEl.append("circle")
            .attr("class", "server-bg")
            .attr("r", 16)
            .attr("fill", "#00ff88")
            .attr("opacity", 0.3)
            .style("filter", "url(#glow-fullscreen)");

          serverEl.append("rect")
            .attr("class", "server-shield")
            .attr("x", -8)
            .attr("y", -8)
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", "#00ff88")
            .attr("opacity", 0.9)
            .attr("rx", 3);

          serverEl.append("text")
            .attr("class", "server-label")
            .attr("text-anchor", "middle")
            .attr("dy", "32")
            .attr("font-family", "monospace")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", "#00bf66")
            .text(server.name);
        });
      });
    
    return cleanup;
  }, [processedAttacks, memoizedServerLocations, cleanup]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex justify-between items-center flex-shrink-0">
        <h3 className="text-2xl font-semibold text-white">Live Attack Vectors</h3>
        {isRefreshing && (
          <div className="flex items-center gap-2 text-sm text-yellow-400">
            <div className="w-4 h-4 border border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Updating...</span>
          </div>
        )}
      </div>
      <div className={`flex-1 min-h-0 transition-opacity duration-300 ${isRefreshing ? 'opacity-75' : 'opacity-100'}`}>
        <svg 
          ref={svgRef} 
          width="100%" 
          height="100%" 
          className="bg-black rounded-lg border border-gray-600" 
        />
      </div>
    </div>
  );
}