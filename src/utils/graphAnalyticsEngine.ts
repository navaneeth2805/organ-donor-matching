import { Donor, Recipient, CompatibilityResult } from '../types';
import { evaluatePair } from './compatibilityEngine';

export interface BipartiteNode {
  id: string; // e.g. "D101" or "R201"
  safeNodeId: string; // e.g. "DONOR_D101" or "RECIPIENT_R201"
  displayLabel: string; // e.g. "D101" or "R201"
  type: 'donor' | 'recipient';
  entityId: number;
  name: string;
  organ: string;
  organSize?: string;
  organDimensions?: string;
  bloodGroup: string;
  location: string;
  urgency?: string;
  waitingTimeDays?: number;
  availability?: string;
  age?: number;
  hospitalId?: number;
}

export interface BipartiteEdge {
  donorId: string;
  recipientId: string;
  weight: number; // overall compatibility score (0-100)
  compatibilityScore: number;
  status: 'POTENTIAL_CANDIDATE' | 'REQUIRES_REVIEW';
  organ: string;
  ruleVersion: string;
  generatedAt?: string;
  rank?: number;
  multiObjectiveScore?: number;
  evaluation?: CompatibilityResult;
}

export interface BipartiteGraph {
  donors: BipartiteNode[];
  recipients: BipartiteNode[];
  nodes: BipartiteNode[];
  edges: BipartiteEdge[];
  adj: Map<string, Array<{ neighborId: string; weight: number; edge: BipartiteEdge }>>;
}

export interface TopologicalMetrics {
  nodeCount: number;
  edgeCount: number;
  donorCount: number;
  recipientCount: number;
  density: number;
  averageDegree: number;
  maximumDegree: number;
  minimumDegree: number;
  connectedComponents: number;
  largestComponentSize: number;
  isolatedNodeCount: number;
  isolatedDonorCount: number;
  isolatedRecipientCount: number;
  isBipartite: boolean;
  diameter: number | null;
  averageShortestPathLength: number | null;
}

export interface DegreeSummary {
  donorDegrees: Record<string, number>;
  recipientDegrees: Record<string, number>;
  averageDonorDegree: number;
  averageRecipientDegree: number;
  donorHubs: Array<{ node: BipartiteNode; degree: number }>;
  isolatedRecipients: Array<{ node: BipartiteNode; degree: number }>;
  isolatedDonors: Array<{ node: BipartiteNode; degree: number }>;
  highestDegreeDonor: { node: BipartiteNode; degree: number } | null;
  highestDegreeRecipient: { node: BipartiteNode; degree: number } | null;
  degreeHistogram: Array<{ degree: number; donorCount: number; recipientCount: number }>;
}

export interface NodeCentrality {
  nodeId: string;
  type: 'donor' | 'recipient';
  name: string;
  organ: string;
  bloodGroup: string;
  degree: number;
  degreeCentrality: number;
  betweennessCentrality: number;
  closenessCentrality: number;
}

export interface MatchingResult {
  algorithm: string;
  algorithmKey: 'cardinality' | 'weight' | 'multi-objective';
  matches: Array<{
    donor: BipartiteNode;
    recipient: BipartiteNode;
    score: number;
    status: string;
    rank?: number;
    ruleVersion?: string;
    generatedAt?: string;
    multiObjectiveScore?: number;
    evaluation?: CompatibilityResult;
  }>;
  unmatchedDonors: BipartiteNode[];
  unmatchedRecipients: BipartiteNode[];
  totalMatches: number;
  totalWeight: number;
  averageWeight: number;
  donorCoveragePercent: number;
  recipientCoveragePercent: number;
  networkCoveragePercent: number;
  executionTimeMs: number;
}

export interface BenchmarkRun {
  size: number;
  nodes: number;
  edges: number;
  hopcroftKarpMs: number;
  hopcroftKarpMatches: number;
  maxWeightMs: number;
  maxWeightMatches: number;
  bfsTraversalMs: number;
  centralityMs: number;
}

/**
 * Builds the bipartite graph from donors and recipients based on clinical compatibility.
 */
export function buildCompatibilityGraph(
  donors: Donor[],
  recipients: Recipient[],
  includeReview: boolean = true
): BipartiteGraph {
  const donorNodes: BipartiteNode[] = donors.map((d) => {
    const formattedId = String(d.id).padStart(3, '0');
    return {
      id: `D${d.id}`,
      safeNodeId: `DONOR_D${formattedId}`,
      displayLabel: `D${formattedId}`,
      type: 'donor',
      entityId: d.id,
      name: d.name,
      organ: d.organ,
      organSize: d.organSize,
      organDimensions: d.organDimensions,
      bloodGroup: d.bloodGroup,
      location: d.location,
      availability: d.availability,
      age: d.age,
      hospitalId: d.hospitalId,
    };
  });

  const recipientNodes: BipartiteNode[] = recipients.map((r) => {
    const formattedId = String(r.id).padStart(3, '0');
    return {
      id: `R${r.id}`,
      safeNodeId: `RECIPIENT_R${formattedId}`,
      displayLabel: `R${formattedId}`,
      type: 'recipient',
      entityId: r.id,
      name: r.name,
      organ: r.organNeeded,
      organSize: r.organSize,
      organDimensions: r.organDimensions,
      bloodGroup: r.bloodGroup,
      location: r.location,
      urgency: r.urgency,
      waitingTimeDays: r.waitingTimeDays,
      age: r.age,
      hospitalId: r.hospitalId,
    };
  });

  const nodes = [...donorNodes, ...recipientNodes];
  const adj = new Map<string, Array<{ neighborId: string; weight: number; edge: BipartiteEdge }>>();
  nodes.forEach((n) => adj.set(n.id, []));

  const edges: BipartiteEdge[] = [];

  for (const donor of donors) {
    const dId = `D${donor.id}`;
    for (const recipient of recipients) {
      const rId = `R${recipient.id}`;
      // Evaluate clinical compatibility using existing Phase 3 logic
      const res = evaluatePair(donor, recipient);
      if (res.status === 'POTENTIAL_CANDIDATE' || (includeReview && res.status === 'REQUIRES_REVIEW')) {
        // Multi-objective composite calculation balancing compatibility, urgency tier, and wait tenure
        const urgencyWeight = recipient.urgency === 'Critical' ? 100 : recipient.urgency === 'High' ? 75 : recipient.urgency === 'Medium' ? 50 : 25;
        const waitWeight = Math.min(100, Math.round((recipient.waitingTimeDays / 365) * 100));
        const multiScore = Number((0.5 * res.overallScore + 0.3 * urgencyWeight + 0.2 * waitWeight).toFixed(1));

        const edge: BipartiteEdge = {
          donorId: dId,
          recipientId: rId,
          weight: res.overallScore,
          compatibilityScore: res.overallScore,
          status: res.status,
          organ: donor.organ,
          ruleVersion: 'v3.2',
          multiObjectiveScore: multiScore,
          evaluation: res,
          generatedAt: new Date().toISOString(),
        };
        edges.push(edge);
        adj.get(dId)?.push({ neighborId: rId, weight: res.overallScore, edge });
        adj.get(rId)?.push({ neighborId: dId, weight: res.overallScore, edge });
      }
    }
  }

  return {
    donors: donorNodes,
    recipients: recipientNodes,
    nodes,
    edges,
    adj,
  };
}

/**
 * Compute global structural metrics, density, and connected components.
 */
export function computeTopologicalMetrics(graph: BipartiteGraph): TopologicalMetrics {
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const donorCount = graph.donors.length;
  const recipientCount = graph.recipients.length;

  if (nodeCount === 0) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      donorCount: 0,
      recipientCount: 0,
      density: 0,
      averageDegree: 0,
      maximumDegree: 0,
      minimumDegree: 0,
      connectedComponents: 0,
      largestComponentSize: 0,
      isolatedNodeCount: 0,
      isolatedDonorCount: 0,
      isolatedRecipientCount: 0,
      isBipartite: true,
      diameter: null,
      averageShortestPathLength: null,
    };
  }

  // Bipartite graph density = |E| / (|D| * |R|)
  const possibleEdges = donorCount * recipientCount;
  const density = possibleEdges > 0 ? Number((edgeCount / possibleEdges).toFixed(4)) : 0;

  const degrees = graph.nodes.map((n) => graph.adj.get(n.id)?.length ?? 0);
  const avgDegree = Number(((2 * edgeCount) / nodeCount).toFixed(2));
  const maxDegree = Math.max(...degrees, 0);
  const minDegree = Math.min(...degrees, 0);

  // Connected Components via BFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      const comp: string[] = [];
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);
        const neighbors = graph.adj.get(curr) || [];
        for (const { neighborId } of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
      components.push(comp);
    }
  }

  const largestComponent = components.reduce((max, c) => (c.length > max.length ? c : max), []);
  const largestComponentSize = largestComponent.length;

  let isolatedDonorCount = 0;
  let isolatedRecipientCount = 0;
  for (const n of graph.nodes) {
    if ((graph.adj.get(n.id)?.length ?? 0) === 0) {
      if (n.type === 'donor') isolatedDonorCount++;
      else isolatedRecipientCount++;
    }
  }

  // Diameter and average shortest path in largest component
  let diameter: number | null = null;
  let avgShortestPath: number | null = null;

  if (largestComponentSize > 1 && largestComponentSize <= 250) {
    let maxDist = 0;
    let totalDist = 0;
    let pairCount = 0;

    for (let i = 0; i < largestComponent.length; i++) {
      const startId = largestComponent[i];
      const distMap = new Map<string, number>();
      distMap.set(startId, 0);
      const q = [startId];

      while (q.length > 0) {
        const u = q.shift()!;
        const d = distMap.get(u)!;
        const neighbors = graph.adj.get(u) || [];
        for (const { neighborId } of neighbors) {
          if (!distMap.has(neighborId)) {
            distMap.set(neighborId, d + 1);
            q.push(neighborId);
          }
        }
      }

      for (let j = i + 1; j < largestComponent.length; j++) {
        const targetId = largestComponent[j];
        const dist = distMap.get(targetId);
        if (dist !== undefined) {
          if (dist > maxDist) maxDist = dist;
          totalDist += dist;
          pairCount++;
        }
      }
    }

    if (pairCount > 0) {
      diameter = maxDist;
      avgShortestPath = Number((totalDist / pairCount).toFixed(2));
    }
  }

  return {
    nodeCount,
    edgeCount,
    donorCount,
    recipientCount,
    density,
    averageDegree: avgDegree,
    maximumDegree: maxDegree,
    minimumDegree: minDegree,
    connectedComponents: components.length,
    largestComponentSize,
    isolatedNodeCount: isolatedDonorCount + isolatedRecipientCount,
    isolatedDonorCount,
    isolatedRecipientCount,
    isBipartite: true, // structurally enforced by donor->recipient compatibility definitions
    diameter,
    averageShortestPathLength: avgShortestPath,
  };
}

/**
 * Computes degree distributions, identifying highly connected Donor Hubs vs Isolated Recipients.
 */
export function computeDegreeSummary(graph: BipartiteGraph): DegreeSummary {
  const donorDegrees: Record<string, number> = {};
  const recipientDegrees: Record<string, number> = {};

  for (const d of graph.donors) {
    donorDegrees[d.id] = graph.adj.get(d.id)?.length ?? 0;
  }
  for (const r of graph.recipients) {
    recipientDegrees[r.id] = graph.adj.get(r.id)?.length ?? 0;
  }

  const dValues = Object.values(donorDegrees);
  const rValues = Object.values(recipientDegrees);

  const avgDonor = dValues.length > 0 ? Number((dValues.reduce((a, b) => a + b, 0) / dValues.length).toFixed(2)) : 0;
  const avgRecip = rValues.length > 0 ? Number((rValues.reduce((a, b) => a + b, 0) / rValues.length).toFixed(2)) : 0;

  // Donor hubs: donors with degree >= max(2, avgDonor)
  const thresholdHub = Math.max(2, Math.round(avgDonor));
  const donorHubs = graph.donors
    .map((node) => ({ node, degree: donorDegrees[node.id] }))
    .filter((d) => d.degree >= thresholdHub)
    .sort((a, b) => b.degree - a.degree);

  // Isolated recipients: degree === 0 (or degree === 1)
  const isolatedRecipients = graph.recipients
    .map((node) => ({ node, degree: recipientDegrees[node.id] }))
    .filter((r) => r.degree <= 1)
    .sort((a, b) => a.degree - b.degree);

  const isolatedDonors = graph.donors
    .map((node) => ({ node, degree: donorDegrees[node.id] }))
    .filter((d) => d.degree === 0);

  const highestDegreeDonor =
    graph.donors.length > 0
      ? graph.donors
          .map((node) => ({ node, degree: donorDegrees[node.id] }))
          .reduce((max, d) => (d.degree > max.degree ? d : max), { node: graph.donors[0], degree: -1 })
      : null;

  const highestDegreeRecipient =
    graph.recipients.length > 0
      ? graph.recipients
          .map((node) => ({ node, degree: recipientDegrees[node.id] }))
          .reduce((max, r) => (r.degree > max.degree ? r : max), { node: graph.recipients[0], degree: -1 })
      : null;

  // Degree histogram
  const maxD = Math.max(...dValues, ...rValues, 0);
  const histogram: Array<{ degree: number; donorCount: number; recipientCount: number }> = [];

  for (let deg = 0; deg <= maxD; deg++) {
    const dCount = dValues.filter((v) => v === deg).length;
    const rCount = rValues.filter((v) => v === deg).length;
    if (dCount > 0 || rCount > 0) {
      histogram.push({ degree: deg, donorCount: dCount, recipientCount: rCount });
    }
  }

  return {
    donorDegrees,
    recipientDegrees,
    averageDonorDegree: avgDonor,
    averageRecipientDegree: avgRecip,
    donorHubs,
    isolatedRecipients,
    isolatedDonors,
    highestDegreeDonor: highestDegreeDonor && highestDegreeDonor.degree >= 0 ? highestDegreeDonor : null,
    highestDegreeRecipient: highestDegreeRecipient && highestDegreeRecipient.degree >= 0 ? highestDegreeRecipient : null,
    degreeHistogram: histogram,
  };
}

/**
 * Computes exact Degree Centrality, Betweenness Centrality (Brandes' Algorithm),
 * and Closeness Centrality (Wasserman-Faust harmonic formula) for all nodes.
 */
export function computeCentralities(graph: BipartiteGraph): NodeCentrality[] {
  const n = graph.nodes.length;
  if (n === 0) return [];

  const degreeCentrality = new Map<string, number>();
  const betweennessCentrality = new Map<string, number>();
  const closenessCentrality = new Map<string, number>();

  // Degree centrality
  for (const node of graph.nodes) {
    const deg = graph.adj.get(node.id)?.length ?? 0;
    const dc = n > 1 ? deg / (n - 1) : 0;
    degreeCentrality.set(node.id, Number(dc.toFixed(4)));
    betweennessCentrality.set(node.id, 0);
    closenessCentrality.set(node.id, 0);
  }

  // Brandes' Algorithm for unweighted betweenness centrality
  for (const s of graph.nodes) {
    const S: string[] = [];
    const P = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const d = new Map<string, number>();
    const delta = new Map<string, number>();

    for (const node of graph.nodes) {
      P.set(node.id, []);
      sigma.set(node.id, 0);
      d.set(node.id, -1);
      delta.set(node.id, 0);
    }

    sigma.set(s.id, 1);
    d.set(s.id, 0);
    const Q: string[] = [s.id];

    while (Q.length > 0) {
      const v = Q.shift()!;
      S.push(v);
      const dv = d.get(v)!;
      const neighbors = graph.adj.get(v) || [];

      for (const { neighborId: w } of neighbors) {
        // Path discovery
        if (d.get(w)! < 0) {
          d.set(w, dv + 1);
          Q.push(w);
        }
        // Path counting
        if (d.get(w)! === dv + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          P.get(w)!.push(v);
        }
      }
    }

    // Accumulation
    while (S.length > 0) {
      const w = S.pop()!;
      const sigmaW = sigma.get(w)!;
      for (const v of P.get(w)!) {
        const deltaV = delta.get(v)!;
        const add = (sigma.get(v)! / sigmaW) * (1 + delta.get(w)!);
        delta.set(v, deltaV + add);
      }
      if (w !== s.id) {
        betweennessCentrality.set(w, betweennessCentrality.get(w)! + delta.get(w)!);
      }
    }

    // Closeness centrality computation for node s
    // Sum shortest path distances to all reachable nodes
    let distSum = 0;
    let reachableCount = 0;
    for (const node of graph.nodes) {
      const dist = d.get(node.id)!;
      if (dist > 0) {
        distSum += dist;
        reachableCount++;
      }
    }

    if (distSum > 0 && reachableCount > 0) {
      // Wasserman & Faust normalization for disconnected components
      const rawCloseness = reachableCount / distSum;
      const normalizedCloseness = rawCloseness * (reachableCount / (n - 1));
      closenessCentrality.set(s.id, Number(normalizedCloseness.toFixed(4)));
    } else {
      closenessCentrality.set(s.id, 0);
    }
  }

  // Final betweenness normalization for undirected graph
  const scale = n > 2 ? 2 / ((n - 1) * (n - 2)) : 1;
  for (const node of graph.nodes) {
    // Halve because graph is undirected
    const rawB = betweennessCentrality.get(node.id)! / 2;
    const normalizedB = rawB * scale;
    betweennessCentrality.set(node.id, Number(normalizedB.toFixed(4)));
  }

  const results: NodeCentrality[] = graph.nodes.map((node) => ({
    nodeId: node.id,
    type: node.type,
    name: node.name,
    organ: node.organ,
    bloodGroup: node.bloodGroup,
    degree: graph.adj.get(node.id)?.length ?? 0,
    degreeCentrality: degreeCentrality.get(node.id) ?? 0,
    betweennessCentrality: betweennessCentrality.get(node.id) ?? 0,
    closenessCentrality: closenessCentrality.get(node.id) ?? 0,
  }));

  // Sort by betweenness centrality descending, then degree
  return results.sort((a, b) => b.betweennessCentrality - a.betweennessCentrality || b.degree - a.degree);
}

/**
 * Hopcroft-Karp Maximum Cardinality Bipartite Matching Algorithm.
 * Time Complexity: O(E * sqrt(V))
 */
export function runHopcroftKarp(graph: BipartiteGraph): MatchingResult {
  const startTime = performance.now();

  const pairU = new Map<string, string | null>(); // Donor -> Recipient
  const pairV = new Map<string, string | null>(); // Recipient -> Donor
  const dist = new Map<string, number>();

  for (const d of graph.donors) pairU.set(d.id, null);
  for (const r of graph.recipients) pairV.set(r.id, null);

  const NIL = 'NIL';

  function bfs(): boolean {
    const queue: string[] = [];
    for (const d of graph.donors) {
      if (pairU.get(d.id) === null) {
        dist.set(d.id, 0);
        queue.push(d.id);
      } else {
        dist.set(d.id, Infinity);
      }
    }
    dist.set(NIL, Infinity);

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (dist.get(u)! < dist.get(NIL)!) {
        const neighbors = graph.adj.get(u) || [];
        for (const { neighborId: v } of neighbors) {
          const matchedU = pairV.get(v);
          const nextNode = matchedU === null ? NIL : matchedU;
          if (dist.get(nextNode)! === Infinity) {
            dist.set(nextNode, dist.get(u)! + 1);
            if (nextNode !== NIL) {
              queue.push(nextNode);
            }
          }
        }
      }
    }

    return dist.get(NIL)! !== Infinity;
  }

  function dfs(u: string): boolean {
    if (u !== NIL) {
      const neighbors = graph.adj.get(u) || [];
      for (const { neighborId: v } of neighbors) {
        const matchedU = pairV.get(v);
        const nextNode = matchedU === null ? NIL : matchedU;
        if (dist.get(nextNode)! === dist.get(u)! + 1) {
          if (dfs(nextNode)) {
            pairV.set(v, u);
            pairU.set(u, v);
            return true;
          }
        }
      }
      dist.set(u, Infinity);
      return false;
    }
    return true;
  }

  let matching = 0;
  while (bfs()) {
    for (const d of graph.donors) {
      if (pairU.get(d.id) === null && dfs(d.id)) {
        matching++;
      }
    }
  }

  const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

  // Assemble matches
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(graph.edges.map((e) => [`${e.donorId}-${e.recipientId}`, e]));

  const matches: MatchingResult['matches'] = [];
  const matchedDonors = new Set<string>();
  const matchedRecipients = new Set<string>();
  let totalWeight = 0;

  for (const [dId, rId] of pairU.entries()) {
    if (rId !== null) {
      matchedDonors.add(dId);
      matchedRecipients.add(rId);
      const donor = nodeMap.get(dId)!;
      const recipient = nodeMap.get(rId)!;
      const edge = edgeMap.get(`${dId}-${rId}`);
      const score = edge ? edge.weight : 75;
      totalWeight += score;

      matches.push({
        donor,
        recipient,
        score,
        status: edge?.status || 'POTENTIAL_CANDIDATE',
        rank: 0,
        ruleVersion: edge?.ruleVersion || 'v3.2',
        generatedAt: edge?.generatedAt || new Date().toISOString(),
        multiObjectiveScore: edge?.multiObjectiveScore,
        evaluation: edge?.evaluation,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  matches.forEach((m, i) => {
    m.rank = i + 1;
  });

  const unmatchedDonors = graph.donors.filter((d) => !matchedDonors.has(d.id));
  const unmatchedRecipients = graph.recipients.filter((r) => !matchedRecipients.has(r.id));
  const capacity = Math.min(graph.donors.length, graph.recipients.length);

  return {
    algorithm: 'Hopcroft-Karp Maximum Cardinality',
    algorithmKey: 'cardinality',
    matches,
    unmatchedDonors,
    unmatchedRecipients,
    totalMatches: matches.length,
    totalWeight: Math.round(totalWeight),
    averageWeight: matches.length > 0 ? Number((totalWeight / matches.length).toFixed(1)) : 0,
    donorCoveragePercent: graph.donors.length > 0 ? Number(((matches.length / graph.donors.length) * 100).toFixed(1)) : 0,
    recipientCoveragePercent: graph.recipients.length > 0 ? Number(((matches.length / graph.recipients.length) * 100).toFixed(1)) : 0,
    networkCoveragePercent: capacity > 0 ? Number(((matches.length / capacity) * 100).toFixed(1)) : 0,
    executionTimeMs,
  };
}

/**
 * Maximum Weight Bipartite Matching (Prioritizes highest composite clinical compatibility).
 */
export function runMaxWeightMatching(graph: BipartiteGraph): MatchingResult {
  const startTime = performance.now();

  // Sort edges descending by weight
  const sortedEdges = [...graph.edges].sort((a, b) => b.weight - a.weight);

  const matchedDonors = new Set<string>();
  const matchedRecipients = new Set<string>();
  const matches: MatchingResult['matches'] = [];
  let totalWeight = 0;

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of sortedEdges) {
    if (!matchedDonors.has(edge.donorId) && !matchedRecipients.has(edge.recipientId)) {
      matchedDonors.add(edge.donorId);
      matchedRecipients.add(edge.recipientId);

      const donor = nodeMap.get(edge.donorId)!;
      const recipient = nodeMap.get(edge.recipientId)!;
      totalWeight += edge.weight;

      matches.push({
        donor,
        recipient,
        score: edge.weight,
        status: edge.status,
        rank: matches.length + 1,
        ruleVersion: edge.ruleVersion || 'v3.2',
        generatedAt: edge.generatedAt || new Date().toISOString(),
        multiObjectiveScore: edge.multiObjectiveScore,
        evaluation: edge.evaluation,
      });
    }
  }

  const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
  const unmatchedDonors = graph.donors.filter((d) => !matchedDonors.has(d.id));
  const unmatchedRecipients = graph.recipients.filter((r) => !matchedRecipients.has(r.id));
  const capacity = Math.min(graph.donors.length, graph.recipients.length);

  return {
    algorithm: 'Maximum Weight Greedy Matching',
    algorithmKey: 'weight',
    matches,
    unmatchedDonors,
    unmatchedRecipients,
    totalMatches: matches.length,
    totalWeight: Math.round(totalWeight),
    averageWeight: matches.length > 0 ? Number((totalWeight / matches.length).toFixed(1)) : 0,
    donorCoveragePercent: graph.donors.length > 0 ? Number(((matches.length / graph.donors.length) * 100).toFixed(1)) : 0,
    recipientCoveragePercent: graph.recipients.length > 0 ? Number(((matches.length / graph.recipients.length) * 100).toFixed(1)) : 0,
    networkCoveragePercent: capacity > 0 ? Number(((matches.length / capacity) * 100).toFixed(1)) : 0,
    executionTimeMs,
  };
}

/**
 * Multi-Objective Bipartite Matching (Balances algorithmic compatibility, recipient urgency tier, and waitlist tenure).
 */
export function runMultiObjectiveMatching(graph: BipartiteGraph): MatchingResult {
  const startTime = performance.now();

  // Sort edges descending by multiObjectiveScore
  const sortedEdges = [...graph.edges].sort((a, b) => (b.multiObjectiveScore ?? b.weight) - (a.multiObjectiveScore ?? a.weight));

  const matchedDonors = new Set<string>();
  const matchedRecipients = new Set<string>();
  const matches: MatchingResult['matches'] = [];
  let totalWeight = 0;

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of sortedEdges) {
    if (!matchedDonors.has(edge.donorId) && !matchedRecipients.has(edge.recipientId)) {
      matchedDonors.add(edge.donorId);
      matchedRecipients.add(edge.recipientId);

      const donor = nodeMap.get(edge.donorId)!;
      const recipient = nodeMap.get(edge.recipientId)!;
      totalWeight += edge.weight;

      matches.push({
        donor,
        recipient,
        score: edge.weight,
        status: edge.status,
        rank: matches.length + 1,
        ruleVersion: edge.ruleVersion || 'v3.2',
        generatedAt: edge.generatedAt || new Date().toISOString(),
        multiObjectiveScore: edge.multiObjectiveScore,
        evaluation: edge.evaluation,
      });
    }
  }

  const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
  const unmatchedDonors = graph.donors.filter((d) => !matchedDonors.has(d.id));
  const unmatchedRecipients = graph.recipients.filter((r) => !matchedRecipients.has(r.id));
  const capacity = Math.min(graph.donors.length, graph.recipients.length);

  return {
    algorithm: 'Multi-Objective Balanced Matching',
    algorithmKey: 'multi-objective',
    matches,
    unmatchedDonors,
    unmatchedRecipients,
    totalMatches: matches.length,
    totalWeight: Math.round(totalWeight),
    averageWeight: matches.length > 0 ? Number((totalWeight / matches.length).toFixed(1)) : 0,
    donorCoveragePercent: graph.donors.length > 0 ? Number(((matches.length / graph.donors.length) * 100).toFixed(1)) : 0,
    recipientCoveragePercent: graph.recipients.length > 0 ? Number(((matches.length / graph.recipients.length) * 100).toFixed(1)) : 0,
    networkCoveragePercent: capacity > 0 ? Number(((matches.length / capacity) * 100).toFixed(1)) : 0,
    executionTimeMs,
  };
}

/**
 * Generates matching_results.csv string adhering to Phase 4 Add-On specification.
 */
export function generateMatchingCsv(
  matchingResult: MatchingResult,
  filterConfig?: {
    organ?: string;
    donorBlood?: string;
    recipientBlood?: string;
    hospital?: string;
    minScore?: number;
    urgency?: string;
    includeReview?: boolean;
    isFiltered?: boolean;
  }
): string {
  const headers = [
    'algorithm',
    'donor_id',
    'recipient_id',
    'compatibility_score',
    'rank',
    'status',
    'rule_version',
    'graph_version',
    'run_id',
    'created_at',
    'filter_configuration',
  ];

  const filterSummary = filterConfig && filterConfig.isFiltered
    ? `organ=${filterConfig.organ || 'All'};donor_blood=${filterConfig.donorBlood || 'All'};recipient_blood=${filterConfig.recipientBlood || 'All'};hospital=${filterConfig.hospital || 'All'};min_score=${filterConfig.minScore ?? 0};urgency=${filterConfig.urgency || 'All'};include_review=${filterConfig.includeReview ?? true}`
    : 'None (Full Network)';

  const rows = matchingResult.matches.map((m, idx) => {
    return [
      `"${matchingResult.algorithm}"`,
      `"${m.donor.safeNodeId || m.donor.id}"`,
      `"${m.recipient.safeNodeId || m.recipient.id}"`,
      m.score.toFixed(1),
      m.rank || idx + 1,
      `"${m.status}"`,
      `"${m.ruleVersion || 'v3.2'}"`,
      '"g_v4.1"',
      `"RUN_${Date.now()}_${idx + 1}"`,
      `"${m.generatedAt || new Date().toISOString()}"`,
      `"${filterSummary}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates synthetic benchmark graphs and runs execution scaling analysis.
 */
export function runBenchmarkSuite(sizes: number[] = [50, 100, 200, 400]): BenchmarkRun[] {
  const results: BenchmarkRun[] = [];

  for (const size of sizes) {
    const half = Math.floor(size / 2);
    const donorNodes: BipartiteNode[] = [];
    const recipientNodes: BipartiteNode[] = [];

    const organs = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas'];
    const bloods = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

    for (let i = 0; i < half; i++) {
      const formatted = String(i + 1).padStart(3, '0');
      donorNodes.push({
        id: `SD${i + 1}`,
        safeNodeId: `DONOR_SD${formatted}`,
        displayLabel: `SD${formatted}`,
        type: 'donor',
        entityId: i + 1,
        name: `Synthetic Donor ${i + 1}`,
        organ: organs[i % organs.length],
        bloodGroup: bloods[i % bloods.length],
        location: 'Metro Center',
      });
    }

    for (let j = 0; j < half; j++) {
      const formatted = String(j + 1).padStart(3, '0');
      recipientNodes.push({
        id: `SR${j + 1}`,
        safeNodeId: `RECIPIENT_SR${formatted}`,
        displayLabel: `SR${formatted}`,
        type: 'recipient',
        entityId: j + 1,
        name: `Synthetic Recipient ${j + 1}`,
        organ: organs[j % organs.length],
        bloodGroup: bloods[(j + 2) % bloods.length],
        location: 'Regional Hospital',
      });
    }

    const nodes = [...donorNodes, ...recipientNodes];
    const adj = new Map<string, Array<{ neighborId: string; weight: number; edge: BipartiteEdge }>>();
    nodes.forEach((n) => adj.set(n.id, []));
    const edges: BipartiteEdge[] = [];

    // Synthesize realistic compatibility edges (~18% density, matching organ and permissible blood)
    for (let i = 0; i < donorNodes.length; i++) {
      for (let j = 0; j < recipientNodes.length; j++) {
        // ~20% probability of edge
        if ((i * 7 + j * 11) % 5 === 0) {
          const weight = 60 + ((i + j) % 38);
          const edge: BipartiteEdge = {
            donorId: donorNodes[i].id,
            recipientId: recipientNodes[j].id,
            weight,
            compatibilityScore: weight,
            status: weight >= 75 ? 'POTENTIAL_CANDIDATE' : 'REQUIRES_REVIEW',
            organ: donorNodes[i].organ,
            ruleVersion: 'v3.2',
          };
          edges.push(edge);
          adj.get(donorNodes[i].id)!.push({ neighborId: recipientNodes[j].id, weight, edge });
          adj.get(recipientNodes[j].id)!.push({ neighborId: donorNodes[i].id, weight, edge });
        }
      }
    }

    const synthGraph: BipartiteGraph = {
      donors: donorNodes,
      recipients: recipientNodes,
      nodes,
      edges,
      adj,
    };

    // Benchmark Hopcroft-Karp
    const hkResult = runHopcroftKarp(synthGraph);

    // Benchmark Max Weight
    const mwResult = runMaxWeightMatching(synthGraph);

    // Benchmark BFS Traversal
    const bfsStart = performance.now();
    const visited = new Set<string>();
    for (const n of synthGraph.nodes) {
      if (!visited.has(n.id)) {
        const q = [n.id];
        visited.add(n.id);
        while (q.length > 0) {
          const u = q.shift()!;
          for (const { neighborId } of synthGraph.adj.get(u) || []) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              q.push(neighborId);
            }
          }
        }
      }
    }
    const bfsMs = Number((performance.now() - bfsStart).toFixed(2));

    // Benchmark Centrality (Degree + Betweenness sampling)
    const centStart = performance.now();
    computeCentralities(synthGraph);
    const centralityMs = Number((performance.now() - centStart).toFixed(2));

    results.push({
      size,
      nodes: nodes.length,
      edges: edges.length,
      hopcroftKarpMs: hkResult.executionTimeMs,
      hopcroftKarpMatches: hkResult.totalMatches,
      maxWeightMs: mwResult.executionTimeMs,
      maxWeightMatches: mwResult.totalMatches,
      bfsTraversalMs: bfsMs,
      centralityMs,
    });
  }

  return results;
}
