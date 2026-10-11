# 001 — VeriScope

This repository contains **VeriScope**, a free, privacy-first, evidence-first fact-checking
Chrome (MV3) extension, built to the master development prompt supplied in-session.

- Project & instructions: [`veriscope/README.md`](veriscope/README.md)
- Build: `cd veriscope && npm install && npm run check && npm run build`
- Load: `chrome://extensions` → Load unpacked → `veriscope/dist`
- Docs: `veriscope/docs/` (architecture, privacy, security, source policy, limitations,
  feature matrix, acceptance tests, troubleshooting, roadmap)
- The former project name “InTruth” is fully replaced by “VeriScope” (configurable via
  `package.json → productName`, with legacy storage migration).

The name “VeriScope” is provisional; trademark/domain availability was not searched.
