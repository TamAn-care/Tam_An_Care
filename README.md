# Tâm An Care V7.3.2 — Health Trend AI Upgrade

This milestone upgrades Health Trend AI to a longitudinal, rules-based analytical engine while preserving the V7.2 AI Gateway/Governance principles.

## Mac quick start
1. Start Docker Desktop.
2. Open Terminal.
3. Run:

```bash
cd ~/Downloads/TamAnCare_V7_3_2_Health_Trend_AI
docker compose down
docker compose up --build
```

If port 5432 is already used by an older Tâm An Care container, stop the older PostgreSQL container first. Do not delete volumes unless you intentionally want to reset data.

## Health check
Open Safari: http://localhost:3000/api/health

Expected version: `7.3.2`.

## Seven engines
Open: http://localhost:3000/api/ai/engines

## Health Trend demo data
Open: http://localhost:3000/api/ai/engines/demo-data/health-trend

## Longitudinal analysis
Use the POST endpoint:
`http://localhost:3000/api/ai/engines/health-trend/analyze`

A ready-to-paste curl command is in `docs/V7.3.2-Health-Trend-Specification.md`.

## Swagger
http://localhost:3000/docs

## Safety
This is a development/test rules engine. It is not a clinical decision-support system and does not replace qualified medical/care professionals.
