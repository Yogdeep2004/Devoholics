import { Archive, Brain, Browser, Cloud, Cpu, Cube, Database, Gauge, HardDrives, Plugs, PlugsConnected, Robot, TreeStructure } from "@phosphor-icons/react";

type IconT = React.ComponentType<{ size?: number; weight?: "regular" | "bold" | "fill" }>;
export const TYPE_META: Record<string, { label: string; color: string; Icon: IconT }> = {
  frontend: { label: "Frontend", color: "#6ea8ec", Icon: Browser },
  backend: { label: "Backend", color: "#62c29a", Icon: HardDrives },
  api: { label: "API", color: "#4fbfb6", Icon: PlugsConnected },
  llm: { label: "LLM", color: "#b79ce8", Icon: Brain },
  agent: { label: "Agent", color: "#e58db0", Icon: Robot },
  orchestrator: { label: "Orchestrator", color: "#e5a15c", Icon: TreeStructure },
  database: { label: "Database", color: "#e0c05a", Icon: Database },
  vector_database: { label: "Vector DB", color: "#a6cf5c", Icon: Cube },
  storage: { label: "Storage", color: "#b9b6ad", Icon: Archive },
  mcp_server: { label: "MCP server", color: "#58c4dc", Icon: Plugs },
  external_service: { label: "External", color: "#8f9bb0", Icon: Cloud },
  infrastructure: { label: "Infra", color: "#e07a7a", Icon: Cpu },
  monitoring: { label: "Monitoring", color: "#8c96e8", Icon: Gauge },
};
