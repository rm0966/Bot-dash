---
name: Pollinations text API authentication
description: The current authentication requirements for Pollinations text generation in this bot project.
---

The legacy Pollinations text endpoint used without authentication is not a dependable integration. Current Pollinations documentation directs OpenAI-compatible generation to `https://gen.pollinations.ai/v1/chat/completions` and requires an API key.

**Why:** The old endpoint could fail while the bot silently swallowed the error, leaving only Discord's typing indicator.

**How to apply:** Verify the provider's current endpoint and authentication before changing this integration. Keep provider errors visible in server logs and never convert failures into empty successful replies.
