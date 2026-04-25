# Installed Claude Skills for PermitIQ

Successfully installed 8 specialized skills from the claude-skills repository for the UMH2026 hackathon project.

## Installation Location
`.claude/skills/` (project-local installation)

## Installed Skills

### 1. Core AI & Agent Architecture (L1 & L2)

#### agent-designer
- **Purpose**: Design multi-agent architectures and JSON schemas for tool-calling
- **Use Case**: Design the contract between GLM and L3 Python calculators
- **Location**: `~/.claude/skills/agent-designer/`

#### senior-prompt-engineer
- **Purpose**: Craft complex prompts for LLM systems
- **Use Case**: Human-in-the-Loop (HITL) interrupts and automated justification filing
- **Location**: `~/.claude/skills/senior-prompt-engineer/`

### 2. Frontend & Dashboard (React + Vite + React Flow)

#### senior-frontend
- **Purpose**: React, Next.js, TypeScript, and Tailwind CSS development
- **Use Case**: Build the "What-If Simulator" and Node-Based Timeline
- **Location**: `~/.claude/skills/senior-frontend/`

#### ui-design-system
- **Purpose**: Design system toolkit with shadcn/ui components
- **Use Case**: Create enterprise-grade UI that impresses hackathon judges
- **Location**: `~/.claude/skills/ui-design-system/`

### 3. Backend & Deterministic Math (L3 Tool Execution)

#### senior-backend
- **Purpose**: REST APIs, microservices, database architectures
- **Use Case**: Build bulletproof Python functions for Overstay Calculator and MTLM Levy
- **Location**: `~/.claude/skills/senior-backend/`

#### mcp-server-builder
- **Purpose**: Model Context Protocol server development
- **Use Case**: Connect Python calculators to AI reasoning engine seamlessly
- **Location**: `~/.claude/skills/mcp-server-builder/`

### 4. Strategic Planning (13MP Compliance)

#### scenario-war-room
- **Purpose**: Multi-variable business scenario modeling
- **Use Case**: Model 13MP Levy Mechanism and "What-If Simulator" logic
- **Location**: `~/.claude/skills/scenario-war-room/`

#### saas-scaffolder
- **Purpose**: Production-ready SaaS boilerplate generator
- **Use Case**: Rapid hackathon scaffolding with auth, database, and routing
- **Location**: `~/.claude/skills/saas-scaffolder/`

## How to Use Skills

Skills are automatically available in Claude Code. Simply reference them in your prompts:

```
Using the agent-designer skill, help me design the multi-agent architecture for PermitIQ
```

```
With the senior-frontend skill, scaffold the React Flow timeline component
```

```
Using the scenario-war-room skill, model the 13MP levy calculation logic
```

## Verification

All skills verified and ready to use. Each skill includes:
- SKILL.md with metadata and instructions
- Python scripts in `scripts/` directory
- Reference documentation
- Example usage patterns

## Next Steps

1. Use **saas-scaffolder** to generate initial project structure
2. Use **agent-designer** to design the agentic architecture
3. Use **senior-backend** to build deterministic calculators
4. Use **senior-frontend** to build the interactive UI
5. Use **scenario-war-room** to implement 13MP logic

---

**Installation Date**: 2026-04-23
**Repository**: https://github.com/alirezarezvani/claude-skills
**Total Skills Installed**: 8
