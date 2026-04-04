// Slack and owner notification helpers

export async function notifySlack(type, data) {
  try {
    await fetch("/api/slack-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
  } catch (e) {
    console.log("[slack-notify] Failed:", e.message);
  }
}

export async function notifyOwners(creatorId, creatorHandle, messageType, extra = {}) {
  try {
    await fetch("/api/notify-owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId, creatorHandle, messageType, ...extra }),
    });
  } catch (e) {
    console.log("[notify] Owner notification failed:", e.message);
  }
}
