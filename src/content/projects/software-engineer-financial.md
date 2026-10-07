---
title: "Financial Institution "
---

## Problem
The specialty software group required a secure, centralized gateway to allow agentic AI workflows to access backend systems while maintaining identity propagation and access control.

## Approach
I migrated financial models using Apache Spark, Pandas, and Apache Iceberg. To accelerate this process, I developed a proof-of-concept tool that combined static analysis with LLM-assisted code transformation to automate the refactoring of legacy code. For the AI infrastructure, I built a Model Context Protocol (MCP) server using FastMCP and FastAPI to serve as a gateway for AI agents. I implemented a header-based authentication mechanism to forward bearer tokens from the UI to the backend and established a service-level allow-list for access control.

## Architecture
The system consists of a centralized Python MCP server built with FastAPI and FastMCP. This server acts as the primary gateway for six or more agentic AI workflows. It utilizes Google ADK for tool implementation and is deployed to an OpenShift Container Platform (OCP) development environment. The architecture includes an HTTP/SSE endpoint for communication and a passthrough mechanism for bearer token authentication to ensure end-to-end identity propagation.

## Results / what I'd change
The MCP server now supports HTTP/SSE endpoints and integrated error handling and retry logic. The infrastructure provides a secure gateway for multiple business groups to deploy agentic AI workflows. I also patched security vulnerabilities across MIDAS repositories to harden the legacy codebase.
