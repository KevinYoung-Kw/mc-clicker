import { transportTopology } from "./routing.js";

export function transportAccess(s, realm) {
  const topology = transportTopology(s, realm);
  const pass = (stage) => {
    const from = topology.stages[stage],
      to = topology.stages[stage + 1];
    if (!from.length) return true; // local villagers/animal batches have their own hand carts
    return (
      from.some((id) => to.includes(id)) ||
      topology.edges.some(
        (e) => e.stage === ["raw", "processed", "delivery"][stage],
      )
    );
  };
  return { topology, raw: pass(0), processed: pass(1), delivery: pass(2) };
}

export function sourceHasRoute(s, id, realm) {
  if (!s.placements[id]) return true;
  const topology = transportTopology(s, realm);
  if (!topology.stages[0].includes(id)) return true;
  return (
    topology.stages[1].includes(id) ||
    topology.edges.some((e) => e.from === id && e.stage === "raw")
  );
}

// A flow record represents the actual transfer out of a regional stock pool.
// Rendering distributes it across that stage's connected paths, never across
// an unrelated diagonal chain or from nominal production estimates.
export function recordTransport(s, realm, quantities, dt) {
  const topology = transportTopology(s, realm);
  const flow = (s.transport ||= { version: 1, edges: {}, realms: {} });
  flow.realms[realm] = { ...quantities, dt, at: s.play };
  const sizes = {};
  for (const edge of topology.edges)
    sizes[edge.stage] = (sizes[edge.stage] || 0) + 1;
  for (const edge of topology.edges) {
    const quantity =
      Math.max(0, quantities[edge.stage] || 0) / sizes[edge.stage];
    const previous = flow.edges[edge.id] || { total: 0 };
    flow.edges[edge.id] = {
      quantity,
      rate: quantity / dt,
      total: previous.total + quantity,
      at: s.play,
    };
  }
  for (const id of Object.keys(flow.edges))
    if (id.startsWith(realm + ":") && !topology.edges.some((e) => e.id === id))
      delete flow.edges[id];
}
