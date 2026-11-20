---
title: "A governed MCP gateway for production agents"
---

**Role:** Built and maintain the server; contributed to the design

**Year:** 2026

**Status:** active

**Tags:** MCP, FastMCP, FastAPI, Google ADK, OpenShift, Python


> How one MCP server gives six production agents a single, authenticated route to backend systems.

## Problem

Our team turns business-team proofs of concept into production agents. Those agents run inside a host application's UI, and each one needs data from backend systems. Without a shared layer, every agent would carry its own integrations and its own idea of who is asking. That means duplicated code, inconsistent access control, and backends that can't tell whose request they're serving.

## Approach

I built one Python MCP server with FastMCP and FastAPI as the single route from agents to backend systems.

- **Identity passthrough.** The agents are embedded in the host UI, so the server accepts the incoming request headers and forwards the bearer token. Each backend authenticates the real user's request directly. The gateway never acts as a shared service account.
- **Service allow list.** Which backends an agent can reach is an explicit list, not an open door. Onboarding an agent means adding it to the list, not building a new integration.
- **Tools as the contract.** Business teams write the prompts. I build the tools the agents call, including retrieval over text and structured data pulled from databases, so the agent code stays focused on behavior.

## Architecture

- Agents are built with Google ADK (sub-agents, workflows, session state) and deployed to OpenShift.
- Each agent has its own code repo and Helm chart repo, deployed through DevOps-provided GitHub Actions workflows.
- Agents call tools over MCP. The gateway handles routing, header forwarding, and the allow list.

```text
Host app UI -> ADK agent -> MCP gateway -> backend systems
                 (bearer token forwarded end to end)
```

## Results

- Six agents use the gateway today, with more onboarding as the ecosystem grows.
- Five agents are live in production, and the gateway is the shared path they use to reach backend data.
- Adding an agent's backend access is a configuration change rather than new integration code.

## What I'd change

[Your answer here. Two or three honest sentences, for example what you'd do differently on tool granularity, testing, or how the allow list is managed.]
