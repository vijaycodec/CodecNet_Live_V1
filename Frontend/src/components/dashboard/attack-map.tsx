'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';
import { useThreatData } from '../../contexts/ThreatDataContext';

// Types (keeping local for component use)
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

// Removed Globe3D dynamic import - using 2D map only


// Unified 2D Map Component with performance enhancements
const Map2D: React.FC<{
  attacks: AttackData[],
  threats: ThreatData[],
  arcs: ArcData[],
  isRefreshing?: boolean,
  serverLocations?: Array<{ ip: string, lat: number, lng: number, country: string }>
}> = ({ attacks, threats, arcs, isRefreshing = false, serverLocations = [] }) => {
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
        id: `server-${server.ip}` // Stable ID for D3 data binding
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

    // Throttle processing to max 60fps
    if (now - lastRenderTime.current < 16.67) {
      return attacks;
    }
    lastRenderTime.current = now;

    // Limit to maximum 50 attacks for performance
    const limitedAttacks = attacks.slice(0, 50);

    return limitedAttacks.map((attack, index) => ({
      ...attack,
      id: `attack-${attack.id || index}`, // Stable ID for D3
      animationDelay: index * 50, // Stagger animations
    }));
  }, [attacks]);

  // Debounced cleanup function
  const cleanup = useCallback(() => {
    // Cancel all animation frames
    animationFramesRef.current.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    animationFramesRef.current.clear();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Get actual SVG dimensions
    const svgElement = svgRef.current;
    const width = svgElement.clientWidth || 800;
    const height = svgElement.clientHeight || 500;

    // Create main group for zoom/pan transformations
    const mainGroup = svg.append("g").attr("class", "main-group");

    // Set up projection with dynamic width
    const projection = d3.geoNaturalEarth1()
      .scale(width / 5)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Optimized zoom behavior - disable animations during zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 8])
      .translateExtent([[-100, -100], [width + 100, height + 100]])
      .extent([[0, 0], [width, height]])
      .filter((event) => {
        // Prevent default browser behavior
        event.preventDefault();
        return !event.ctrlKey && !event.button;
      })
      .on("start", () => {
        svg.style("cursor", "grabbing");
        // Reduce opacity of animations during interaction
        svg.selectAll(".moving-pulse, .attack-dot").style("opacity", "0");
      })
      .on("zoom", (event) => {
        mainGroup.attr("transform", event.transform);
      })
      .on("end", () => {
        svg.style("cursor", "grab");
        // Restore animations after interaction
        svg.selectAll(".attack-dot").style("opacity", null);
        svg.selectAll(".moving-pulse").style("opacity", null);
      });

    // Apply zoom behavior to SVG
    svg.call(zoom)
      .style("cursor", "grab");

    // Add zoom controls - positioned on left side
    const zoomControls = svg.append("g")
      .attr("class", "zoom-controls")
      .attr("transform", "translate(10, 10)");

    // Zoom in button
    const zoomInBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .style("cursor", "pointer");

    zoomInBtn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", "#1f2937")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1)
      .attr("rx", 4);

    zoomInBtn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .attr("fill", "#e5e7eb")
      .text("+");

    zoomInBtn.on("click", () => {
      svg.transition().duration(300).call(
        zoom.scaleBy, 1.5
      );
    });

    // Zoom out button
    const zoomOutBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .attr("transform", "translate(0, 35)")
      .style("cursor", "pointer");

    zoomOutBtn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", "#1f2937")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1)
      .attr("rx", 4);

    zoomOutBtn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .attr("fill", "#e5e7eb")
      .text("−");

    zoomOutBtn.on("click", () => {
      svg.transition().duration(300).call(
        zoom.scaleBy, 0.67
      );
    });

    // Reset zoom button
    const resetBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .attr("transform", "translate(0, 70)")
      .style("cursor", "pointer");

    resetBtn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", "#1f2937")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1)
      .attr("rx", 4);

    resetBtn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "#e5e7eb")
      .text("⌂");

    resetBtn.on("click", () => {
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1).translate(-width / 2, -height / 2)
      );
    });

    // Create futuristic effects and filters
    const defs = svg.append("defs");

    // Glowing filter for futuristic elements
    const glowFilter = defs.append("filter")
      .attr("id", "glow")
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

    // Pulse filter for animations
    const pulseFilter = defs.append("filter")
      .attr("id", "pulse")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");

    pulseFilter.append("feGaussianBlur")
      .attr("stdDeviation", "2")
      .attr("result", "coloredBlur");

    const pulseMerge = pulseFilter.append("feMerge");
    pulseMerge.append("feMergeNode").attr("in", "coloredBlur");
    pulseMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Create world map like the provided image
    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then((world: any) => {
        // Draw dark background
        mainGroup.append("rect")
          .attr("width", width)
          .attr("height", height)
          .attr("fill", "#000000ff");

        // Draw countries with the exact styling from the image - dark gray with borders
        mainGroup.append("g")
          .selectAll("path")
          .data(world.features)
          .enter()
          .append("path")
          .attr('d', (d: any) => path(d))
          .attr("fill", "#d2d2d2ff")
          .attr("stroke", "#a7a7a7ff")
          .attr("stroke-width", 0.5);

        // Create attack visualization group
        const attackGroup = mainGroup.append("g").attr("class", "attacks");

        // Batch render attack vectors with efficient data binding
        const attackSelection = attackGroup.selectAll(".attack-group")
          .data(processedAttacks, (d: any) => d.id);

        // Enter selection for new attacks
        const attackEnter = attackSelection.enter()
          .append("g")
          .attr("class", "attack-group")
          .attr("data-attack-id", (d: any) => d.id);

        // Process attacks in batches to avoid blocking
        const batchSize = 10;
        let currentBatch = 0;

        const processBatch = () => {
          const startIdx = currentBatch * batchSize;
          const endIdx = Math.min(startIdx + batchSize, processedAttacks.length);
          const batchAttacks = processedAttacks.slice(startIdx, endIdx);

          batchAttacks.forEach((attack, batchIndex) => {
            const globalIndex = startIdx + batchIndex;
            const source = projection([attack.sourceLng, attack.sourceLat]);
            const target = projection([attack.targetLng, attack.targetLat]);

            if (!source || !target) return;

            // Create efficient attack group
            const attackGroupEl = attackEnter.filter((d: any) => d.id === attack.id)
              .append("g")
              .attr("class", "attack-elements")
              .attr("transform", `translate(${source[0]}, ${source[1]})`);

            // Optimized attack dot with CSS animations
            attackGroupEl.append("circle")
              .attr("class", "attack-dot")
              .attr("r", 3)
              .attr("fill", "#ff4444")
              .attr("opacity", 0)
              .style("filter", "url(#pulse)")
              .transition()
              .delay((attack.animationDelay ?? 0) + 200)
              .duration(300)
              .attr("opacity", 1);

            // Efficient attack line
            attackGroup.append("line")
              .attr("class", "attack-line")
              .attr("x1", source[0])
              .attr("y1", source[1])
              .attr("x2", target[0])
              .attr("y2", target[1])
              .attr("stroke", "#00d7d7ff")
              .attr("stroke-width", 1.5)
              .attr("opacity", 0)
              .attr("stroke-dasharray", "5,5")
              .style("filter", "url(#glow)")
              .transition()
              .delay((attack.animationDelay ?? 0) + 200)
              .duration(500)
              .attr("opacity", 0.6);

            // Removed continuous pulse animation for better performance
          });

          currentBatch++;
          if (currentBatch * batchSize < processedAttacks.length) {
            // Process next batch on next frame
            const frameId = requestAnimationFrame(() => {
              animationFramesRef.current.add(frameId);
              processBatch();
              animationFramesRef.current.delete(frameId);
            });
          }
        };

        // Start batch processing
        processBatch();

        // Enhanced futuristic arrow marker
        defs.append("marker")
          .attr("id", "arrowhead")
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 8)
          .attr("refY", 0)
          .attr("markerWidth", 8)
          .attr("markerHeight", 8)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M0,-5L10,0L0,5")
          .attr("fill", "#00ffff")
          .style("filter", "url(#glow)");

        // Optimized server rendering with data binding
        const serverGroup = attackGroup.append("g").attr("class", "servers");

        const servers = serverGroup.selectAll(".server")
          .data(memoizedServerLocations, (d: any) => d.id);

        const serverEnter = servers.enter()
          .append("g")
          .attr("class", "server")
          .attr("data-server-id", (d: any) => d.id)
          .attr("transform", (d: any) => {
            const coords = projection([d.lng, d.lat]);
            return coords ? `translate(${coords[0]}, ${coords[1]})` : "translate(0,0)";
          });

        // Efficient server icons with reduced DOM elements
        serverEnter.append("circle")
          .attr("class", "server-bg")
          .attr("r", 12)
          .attr("fill", "#00ff88")
          .attr("opacity", 0.3)
          .style("filter", "url(#glow)");

        serverEnter.append("rect")
          .attr("class", "server-shield")
          .attr("x", -6)
          .attr("y", -6)
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", "#00ff88")
          .attr("opacity", 0.9)
          .attr("rx", 2);

        serverEnter.append("text")
          .attr("class", "server-label")
          .attr("text-anchor", "middle")
          .attr("dy", "25")
          .attr("font-family", "monospace")
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .attr("fill", "#00bf66ff")
          .text((d: any) => d.name);

        // Draw OTX threat arcs
        arcs.forEach((arc, index) => {
          const source = projection([arc.startLng, arc.startLat]);
          const target = projection([arc.endLng, arc.endLat]);

          if (!source || !target) return;

          const dx = target[0] - source[0];
          const dy = target[1] - source[1];
          const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;

          mainGroup.append("path")
            .attr("d", `M${source[0]},${source[1]} Q${(source[0] + target[0]) / 2},${(source[1] + target[1]) / 2 - dr * 0.3} ${target[0]},${target[1]}`)
            .attr("fill", "none")
            .attr("stroke", arc.color)
            .attr("stroke-width", arc.strokeWidth * 0.5)
            .attr("opacity", 0)
            .attr("stroke-dasharray", "5,5")
            .style("filter", "url(#glow)")
            .transition()
            .delay(index * 100)
            .duration(800)
            .attr("opacity", 0.3);
        });

        // Draw OTX threat points
        const threatGroup = mainGroup.append("g").attr("class", "otx-threats");

        threats.forEach((threat, index) => {
          const coords = projection([threat.lng, threat.lat]);
          if (!coords) return;

          const group = threatGroup.append("g")
            .attr("transform", `translate(${coords[0]}, ${coords[1]})`);

          // Outer glow circle
          group.append("circle")
            .attr("r", threat.size * 12)
            .attr("fill", threat.color)
            .attr("opacity", 0)
            .style("filter", "url(#glow)")
            .transition()
            .delay(index * 50)
            .duration(500)
            .attr("opacity", 0.25);

          // Inner point
          group.append("circle")
            .attr("r", threat.size * 4)
            .attr("fill", threat.color)
            .attr("opacity", 0)
            .transition()
            .delay(index * 50)
            .duration(500)
            .attr("opacity", 0.8);

          // Tooltip
          group.append("title")
            .text(`${threat.attackType}\nThreats: ${threat.count}${threat.country ? '\n' + threat.country : ''}`);
        });
      });

    return cleanup;
  }, [processedAttacks, memoizedServerLocations, threats, arcs, cleanup]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white mb-2">Live Attack Vectors & Threat Intelligence</h3>
        <div className="flex items-center gap-3">
          {isRefreshing && (
            <div className="flex items-center gap-2 text-xs text-yellow-400">
              <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Updating...</span>
            </div>
          )}
          <button
            onClick={() => window.open('/attack-vectors', '_blank')}
            className="p-1 text-gray-400 hover:text-white transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
      <div className={`transition-opacity duration-300 ${isRefreshing ? 'opacity-75' : 'opacity-100'} w-full`}>
        <svg
          ref={svgRef}
          width="100%"
          height="500"
          className="bg-black rounded-lg border border-gray-600 w-full"
          preserveAspectRatio="xMidYMid meet"
        />
      </div>
    </div>
  );
};

// Removed ThreatMap2D component - merged into unified Map2D

// Main Component - Now optimized to use context
export function AttackMap() {
  const { attacks, threats, arcs, serverLocations, isLoading, lastUpdated, refreshData, isRefreshing } = useThreatData();

  // Only show loading screen on initial load when there's no data
  if (isLoading && attacks.length === 0 && threats.length === 0) {
    return (
      <div className="w-full h-[600px] bg-gray-800 rounded-lg p-6 border border-gray-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-300 mt-4">Loading threat intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] bg-gray-800 rounded-lg p-6 border border-gray-700 relative">
      {/* Background refresh indicator */}
      {isRefreshing && (
        <div className="absolute top-4 right-4 z-10 bg-blue-600/20 backdrop-blur-sm border border-blue-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-blue-300 text-sm">Updating data...</span>
        </div>
      )}

      {/* Header with refresh info */}
      {/* <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Live Threat Intelligence</h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 animate-pulse'}`}></div>
            <span>{isRefreshing ? 'Updating...' : 'Live Feed'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm rounded transition-colors flex items-center gap-2"
          >
            <svg 
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div> */}

      {/* Stats Bar with loading indicators */}
      {/* <div className="flex gap-4 mb-4 text-sm">
        <div className={`bg-gray-700 px-3 py-1 rounded transition-all duration-300 ${isRefreshing ? 'bg-gray-600 animate-pulse' : ''}`}>
          <span className="text-gray-400">Attack Vectors: </span>
          <span className="text-red-400 font-semibold">{attacks.length}</span>
          {isRefreshing && <span className="text-yellow-400 ml-1">↻</span>}
        </div>
        <div className={`bg-gray-700 px-3 py-1 rounded transition-all duration-300 ${isRefreshing ? 'bg-gray-600 animate-pulse' : ''}`}>
          <span className="text-gray-400">Global Threats: </span>
          <span className="text-orange-400 font-semibold">{threats.length}</span>
          {isRefreshing && <span className="text-yellow-400 ml-1">↻</span>}
        </div>
        <div className={`bg-gray-700 px-3 py-1 rounded transition-all duration-300 ${isRefreshing ? 'bg-gray-600 animate-pulse' : ''}`}>
          <span className="text-gray-400">Active Connections: </span>
          <span className="text-blue-400 font-semibold">{arcs.length}</span>
          {isRefreshing && <span className="text-yellow-400 ml-1">↻</span>}
        </div>
      </div> */}

      {/* Unified Full Width Map */}
      <div className="h-full">
        <Map2D
          attacks={attacks}
          threats={threats}
          arcs={arcs}
          isRefreshing={isRefreshing}
          serverLocations={serverLocations}
        />
      </div>
    </div>
  );
}
