import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Step } from '../types';

interface FlowGraphProps {
  steps: Step[];
}

export const FlowGraph: React.FC<FlowGraphProps> = ({ steps }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || steps.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const padding = 20;

    // Simple tree/flow layout logic
    const nodeWidth = 140;
    const nodeHeight = 40;
    const gapY = 40;

    // Create data structure for D3
    const nodes = steps.map((step, i) => ({
      id: step.id,
      label: step.action,
      x: width / 2 - nodeWidth / 2,
      y: padding + i * (nodeHeight + gapY),
      status: step.status
    }));

    // Draw Lines
    nodes.forEach((node, i) => {
      if (i < nodes.length - 1) {
        const next = nodes[i + 1];
        svg.append("line")
          .attr("x1", node.x + nodeWidth / 2)
          .attr("y1", node.y + nodeHeight)
          .attr("x2", next.x + nodeWidth / 2)
          .attr("y2", next.y)
          .attr("stroke", "#475569")
          .attr("stroke-width", 2)
          .attr("marker-end", "url(#arrowhead)");
      }
    });

    // Define Marker
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 5)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#475569");

    // Draw Nodes
    const nodeGroup = svg.selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x}, ${d.y})`);

    nodeGroup.append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("rx", 6)
      .attr("fill", "#1e293b")
      .attr("stroke", d => d.status === 'success' ? '#22c55e' : '#3b82f6')
      .attr("stroke-width", 1);

    nodeGroup.append("text")
      .attr("x", nodeWidth / 2)
      .attr("y", nodeHeight / 2)
      .attr("dy", "0.3em")
      .attr("text-anchor", "middle")
      .attr("fill", "#e2e8f0")
      .attr("font-size", "12px")
      .attr("font-family", "monospace")
      .text(d => d.label.toUpperCase());

  }, [steps]);

  if (steps.length === 0) return (
    <div className="flex items-center justify-center h-full text-slate-600 text-sm">
      Graph Visualization
    </div>
  );

  return (
    <svg ref={svgRef} className="w-full h-full bg-slate-900/50" />
  );
};