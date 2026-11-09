# Historical EVM web source

These inactive components are retained for reference outside the active Next.js package. They depend on the earlier Privy/EVM flow and original import paths; they are not a second app or a supported NEAR flow. Restore the complete baseline at commit `042714b` to reproduce the historical application.

The active web package no longer installs the Privy SDK. This removes its unused wallet dependency graph from NEAR builds. EVM contract/core/CLI material remains elsewhere as explicitly legacy code.
