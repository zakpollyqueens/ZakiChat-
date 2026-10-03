const ADMIN_SYSTEM_CONFIG = {
  functionUrl: "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step",
  sessionKey: "zakichat-admin-session",
  roleKey: "zakichat-admin-role",
  expiryKey: "zakichat-admin-expiry"
};

function adminSystemSession() {
  return localStorage.getItem(ADMIN_SYSTEM_CONFIG.sessionKey);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function adminSystemRequest(body) {
  const response = await fetch(ADMIN_SYSTEM_CONFIG.functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Admin request failed.");
  }

  return data;
}

function showSystemError(message) {
  setText("systemStatus", "Connection error");
  console.error("ZakiChat Admin System:", message);
}

function renderStatus(status) {
  if (!status) return;

  setText("applicationName", status.application_name || "ZakiChat");
  setText("applicationVersion", status.application_version || "zc-vr15");
  setText(
    "environment",
    status.environment
      ? String(status.environment).replace(/^./, c => c.toUpperCase())
      : "Production"
  );

  setText(
    "systemStatus",
    status.database_status === "connected"
      ? "Operational"
      : "Unavailable"
  );

  setText(
    "registrationStatus",
    status.registration_enabled ? "Enabled" : "Disabled"
  );

  setText(
    "maintenanceStatus",
    status.maintenance_mode ? "Enabled" : "Disabled"
  );

  setText(
    "publicUpdatesStatus",
    status.public_updates_enabled ? "Enabled" : "Disabled"
  );
}

async function loadSystemStatus() {
  const token = adminSystemSession();

  if (!token) {
    window.location.href = "admin.html";
    return;
  }

  const data = await adminSystemRequest({
    action: "admin-system-status",
    adminSessionToken: token
  });

  if (!data.success) {
    throw new Error(data.error || "System status request failed.");
  }

  renderStatus(data.status || data.data || {});
}

async function refreshAdminSession() {
  const token = adminSystemSession();

  if (!token) {
    window.location.href = "admin.html";
    return;
  }

  const data = await adminSystemRequest({
    action: "admin-session-verify",
    adminSessionToken: token
  });

  if (!data.success) {
    throw new Error(data.error || "Session verification failed.");
  }

  if (data.role) {
    localStorage.setItem(
      ADMIN_SYSTEM_CONFIG.roleKey,
      data.role
    );
  }

  if (data.expiresAt) {
    localStorage.setItem(
      ADMIN_SYSTEM_CONFIG.expiryKey,
      data.expiresAt
    );
  }

  await loadSystemStatus();
}

async function revokeAdminSession() {
  const token = adminSystemSession();

  if (!token) {
    window.location.href = "admin.html";
    return;
  }

  await adminSystemRequest({
    action: "admin-session-revoke",
    adminSessionToken: token
  });

  localStorage.removeItem(ADMIN_SYSTEM_CONFIG.sessionKey);
  localStorage.removeItem(ADMIN_SYSTEM_CONFIG.roleKey);
  localStorage.removeItem(ADMIN_SYSTEM_CONFIG.expiryKey);

  window.location.href = "admin.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await refreshAdminSession();
  } catch (error) {
    showSystemError(error.message);
  }

  const refreshButton = document.getElementById("refreshSessionBtn");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      try {
        refreshButton.disabled = true;
        await refreshAdminSession();
      } catch (error) {
        showSystemError(error.message);
      } finally {
        refreshButton.disabled = false;
      }
    });
  }

  const revokeButton = document.getElementById("revokeSessionBtn");
  if (revokeButton) {
    revokeButton.addEventListener("click", async () => {
      try {
        revokeButton.disabled = true;
        await revokeAdminSession();
      } catch (error) {
        showSystemError(error.message);
        revokeButton.disabled = false;
      }
    });
  }
});
