---
name: Discord gateway session persistence
description: Security and lifecycle decisions for restoring Discord bot gateway sessions after server restarts.
---

Persisted Discord bot tokens must remain encrypted at rest, and the encryption key must stay server-side. Turning AI off should retain the saved session and preferences; explicitly disconnecting the bot should remove its saved credential so it is not restored later.

**Why:** Automatic recovery requires the bot token to survive process restarts, while plaintext storage or restoring after an intentional stop would create security and user-control problems.

**How to apply:** Keep session persistence behind the encrypted store, verify the supplied bot token before viewing or deleting a saved session, and preserve the distinction between an AI toggle and a full bot disconnect.
