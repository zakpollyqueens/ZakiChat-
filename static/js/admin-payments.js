"use strict";

const FUNCTION_URL =
  "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

const SUPABASE_URL =
  window.ZakiChatConfig?.supabaseUrl ||
  "https://xdpevlurgtvgduwzyoue.supabase.co";

const SUPABASE_KEY =
  window.ZakiChatConfig?.supabaseKey || "";

const SESSION_KEY = "zakichat-admin-session";
const ROLE_KEY = "zakichat-admin-role";
const EXPIRY_KEY = "zakichat-admin-expiry";
const ADMIN_CONTENT_URL = `${SUPABASE_URL}/functions/v1/admin-content`;
let upgradeRequests = [];
let registrationPaymentRequests = [];
let selectedUpgradeRequestId = null;

const $ = id => document.getElementById(id);

function show(id, visible = true) {
  const el = $(id);
  if (el) el.classList.toggle("hidden", !visible);
}

function getToken() {
  return localStorage.getItem(SESSION_KEY);
}

function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

async function rpc(name, body) {
  const actionMap = {
    admin_upgrade_overview: "admin-upgrade-overview",
    admin_upgrade_records: "admin-upgrade-records",
    admin_manual_upgrade: "admin-manual-upgrade"
  };
  if (actionMap[name]) {
    const args = { ...(body || {}) };
    delete args.p_token;
    const result = await adminContentRequest({
      action: actionMap[name],
      adminSessionToken: getToken(),
      ...args
    });
    return result.result;
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(body)
    }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error_description || data?.hint ||
      data?.details || data?.error || "Supabase RPC request failed."
    );
  }
  return data;
}

async function adminContentRequest(body) {
  const response = await fetch(ADMIN_CONTENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Admin content request failed.");
  }
  return data;
}

async function verifyAdminSession() {
  const token = getToken();

  if (!token) return false;

  const expiry =
    (Date.parse(localStorage.getItem(EXPIRY_KEY) || "") || Number(localStorage.getItem(EXPIRY_KEY) || 0));

  if (expiry && Date.now() >= expiry) {
    clearAdminSession();
    return false;
  }

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: "admin-session-verify",
        adminSessionToken: token
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !(data.success === true || data.valid === true || data.active === true)) {
      clearAdminSession();
      return false;
    }
    if (data.role) localStorage.setItem(ROLE_KEY, data.role);
    if (data.expiresAt || data.expires_at) {
      localStorage.setItem(EXPIRY_KEY, data.expiresAt || data.expires_at);
    }
    return true;
  } catch (error) {
    console.error(
      "Admin session verification failed:",
      error
    );
    return false;
  }
}

async function secureSignOut() {
  const token = getToken();

  try {
    if (token) {
      await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "admin-session-revoke",
          adminSessionToken: token
        })
      });
    }
  } catch (error) {
    console.warn(
      "Remote admin sign-out failed:",
      error
    );
  }

  clearAdminSession();
  location.href = "admin.html";
}

function selectPlan(plan) {
  const select = $("upgradePlan");

  if (!select) return;

  select.value = plan;

  $("manualUpgradeForm")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  const amount =
    plan === "business_monthly"
      ? "10.00"
      : "2.00";

  const amountField =
    $("amountReceived");

  if (amountField) {
    amountField.value = amount;
  }
}

function setupPlanButtons() {
  document
    .querySelectorAll(".plan-select")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          selectPlan(button.dataset.plan);
        }
      );
    });
}

function setupScrollActions() {
  document
    .querySelectorAll("[data-scroll]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const target =
            document.getElementById(
              button.dataset.scroll
            );

          target?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      );
    });
}

function setupPlanAmountSync() {
  $("upgradePlan")?.addEventListener(
    "change",
    event => {
      const amountField =
        $("amountReceived");

      if (!amountField) return;

      amountField.value =
        event.target.value ===
        "business_monthly"
          ? "10.00"
          : "2.00";
    }
  );
}

function showManualResult(
  message,
  error = false
) {
  const box = $("manualResult");

  if (!box) return;

  box.textContent = message;
  box.classList.remove("hidden");

  if (error) {
    box.style.color = "#ffadb5";
    box.style.borderColor =
      "rgba(255,107,122,.2)";
    box.style.background =
      "rgba(255,107,122,.05)";
  } else {
    box.style.color = "#a9f2d2";
    box.style.borderColor =
      "rgba(77,225,161,.18)";
    box.style.background =
      "rgba(77,225,161,.06)";
  }
}

async function handleManualUpgrade(event) {
  event.preventDefault();

  const token = getToken();

  if (!token) {
    showManualResult(
      "Your administrator session is missing. Please sign in again.",
      true
    );
    return;
  }

  const identifier =
    $("customerIdentifier")?.value.trim();

  const plan =
    $("upgradePlan")?.value;

  const method =
    $("paymentMethod")?.value;

  const amount =
    $("amountReceived")?.value;

  const reference =
    $("paymentReference")?.value.trim();

  const notes =
    $("upgradeNotes")?.value.trim();

  if (!identifier || !plan || !amount) {
    showManualResult(
      "Please provide the customer identifier, plan and amount.",
      true
    );
    return;
  }

  const numericAmount = Number(amount);

  const expectedAmount =
    plan === "business_monthly"
      ? 10
      : plan === "personal_monthly"
        ? 2
        : 0;

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount !== expectedAmount
  ) {
    showManualResult(
      `Incorrect amount. This plan requires USD ${expectedAmount.toFixed(2)}.`,
      true
    );
    return;
  }

  const button =
    event.submitter ||
    document.querySelector(
      '#manualUpgradeForm button[type="submit"]'
    );

  const originalText =
    button?.textContent ||
    "Upgrade Account";

  if (button) {
    button.disabled = true;
    button.textContent =
      "Processing Upgrade...";
  }

  showManualResult(
    "Verifying customer and processing the secure upgrade..."
  );

  try {
    const data = await rpc(
      "admin_manual_upgrade",
      {
        p_token: token,
        p_identifier: identifier,
        p_plan: plan,
        p_amount: numericAmount,
        p_payment_method: method,
        p_payment_reference: reference,
        p_notes: notes
      }
    );

    const user = data?.user || {};
    const upgrade = data?.upgrade || {};
    const payment = data?.payment || {};

    const expiry = upgrade.expiresAt
      ? new Date(upgrade.expiresAt)
      : null;

    const expiryText =
      expiry &&
      !Number.isNaN(expiry.getTime())
        ? expiry.toLocaleString()
        : "recorded";

    showManualResult(
      `Upgrade successful. ${
        user.email ||
        user.phone ||
        user.username ||
        "Customer"
      } now has ${
        upgrade.plan ===
        "business_monthly"
          ? "Business"
          : "Personal"
      } access until ${expiryText}. Payment recorded as ${
        payment.status || "paid"
      }.`
    );

    event.target.reset();

    if (selectedUpgradeRequestId) {
      try {
        await adminContentRequest({
          action: "admin-upgrade-request-close",
          adminSessionToken: getToken(),
          id: selectedUpgradeRequestId,
          reason: "Manually processed after payment verification. Upgrade ID: " + (upgrade.id || "recorded")
        });
        selectedUpgradeRequestId = null;
      } catch (closeError) {
        console.warn("Upgrade succeeded but the request could not be closed:", closeError);
        showManualResult("Upgrade was recorded, but the original request remains pending. Close it from Pending Customer Upgrade Requests.", true);
        selectedUpgradeRequestId = null;
      }
    }

    const amountField =
      $("amountReceived");

    if (amountField) {
      amountField.value = "2.00";
    }

    console.info(
      "Secure manual upgrade completed:",
      data
    );

    await loadAll();
  } catch (error) {
    console.error(
      "Manual upgrade failed:",
      error
    );

    showManualResult(
      error instanceof Error
        ? error.message
        : "Unable to complete the upgrade.",
      true
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        originalText;
    }
  }
}

async function loadOverview() {
  const data = await rpc(
    "admin_upgrade_overview",
    { p_token: getToken() }
  );

  $("upgradeMetric").textContent =
    data?.paid_transactions ?? "0";

  $("activeMetric").textContent =
    data?.active_upgrades ?? "0";

  $("registrationMetric").textContent =
    "—";

  const records = await rpc(
    "admin_upgrade_records",
    {
      p_token: getToken(),
      p_search: "",
      p_status: "active",
      p_plan: "all"
    }
  );

  const now = Date.now();
  const sevenDays =
    now + 7 * 24 * 60 * 60 * 1000;

  const expiring = Array.isArray(records)
    ? records.filter(record => {
        const expiry =
          new Date(record.expires_at)
            .getTime();

        return (
          record.status === "active" &&
          expiry > now &&
          expiry <= sevenDays
        );
      }).length
    : 0;

  $("expiringMetric").textContent =
    String(expiring);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadRecords() {
  const records = await rpc(
    "admin_upgrade_records",
    {
      p_token: getToken(),
      p_search: "",
      p_status: "all",
      p_plan: "all"
    }
  );

  const list = $("recordsList");
  const empty = $("recordsEmpty");

  if (!list) return;

  list.innerHTML = "";

  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");

  records.forEach(record => {
    const name =
      record.full_name ||
      record.username ||
      record.email ||
      record.phone ||
      "Customer";

    const plan =
      record.plan ===
      "business_monthly"
        ? "Business"
        : "Personal";

    const article =
      document.createElement("article");

    article.className = "record";

    article.dataset.type =
      record.plan || "";

    article.dataset.status =
      record.status || "";

    article.innerHTML = `
      <div>
        <strong>${escapeHtml(name)}</strong>
        <div>${escapeHtml(
          record.email ||
          record.phone ||
          "—"
        )}</div>
      </div>

      <div>
        <strong>${escapeHtml(plan)}</strong>
        <div>USD ${escapeHtml(
          record.price_usd
        )}</div>
      </div>

      <div>
        <span>${escapeHtml(
          record.status || "—"
        )}</span>
        <div>Expires: ${escapeHtml(
          formatDate(record.expires_at)
        )}</div>
      </div>
    `;

    list.appendChild(article);
  });
}

function applyFilters() {
  const query =
    $("recordSearch")
      ?.value
      .toLowerCase()
      .trim() || "";

  const type =
    $("recordType")?.value || "all";

  const status =
    $("recordStatus")?.value || "all";

  document
    .querySelectorAll(".record")
    .forEach(record => {
      const matchesQuery =
        !query ||
        record.textContent
          .toLowerCase()
          .includes(query);

      const matchesType =
        type === "all" ||
        record.dataset.type === type;

      const matchesStatus =
        status === "all" ||
        record.dataset.status === status;

      record.classList.toggle(
        "hidden",
        !(
          matchesQuery &&
          matchesType &&
          matchesStatus
        )
      );
    });
}

function setupFilters() {
  $("recordSearch")?.addEventListener(
    "input",
    applyFilters
  );

  $("recordType")?.addEventListener(
    "change",
    applyFilters
  );

  $("recordStatus")?.addEventListener(
    "change",
    applyFilters
  );
}

async function loadRegistrationPaymentRequests() {
  const data = await adminContentRequest({
    action: "admin-registration-payment-requests",
    adminSessionToken: getToken()
  });
  registrationPaymentRequests = Array.isArray(data.requests) ? data.requests : [];
  const list = $("registrationPaymentsList");
  const empty = $("registrationPaymentsEmpty");
  $("registrationPaymentsCount").textContent = registrationPaymentRequests.length + " pending registration fee(s)";
  if (!registrationPaymentRequests.length) {
    list.innerHTML = "";
    empty?.removeAttribute("hidden");
    return;
  }
  empty?.setAttribute("hidden", "");
  list.innerHTML = registrationPaymentRequests.map(request => `
    <article class="upgrade-request-card registration-payment-request">
      <div>
        <strong>${escapeHtml(request.phone)}</strong>
        <span>${escapeHtml(request.country_name || request.country_code)} · USD ${escapeHtml(Number(request.fee_usd).toFixed(2))}</span>
        <small>Request: ${escapeHtml(request.id)} · ${escapeHtml(formatDate(request.created_at))}</small>
        <small>Provider: ${escapeHtml(request.provider || "Not configured")}</small>
      </div>
      <div class="upgrade-request-actions">
        <button type="button" data-mark-registration-paid="${escapeHtml(request.id)}">Mark Paid</button>
        <button type="button" data-cancel-registration-payment="${escapeHtml(request.id)}">Cancel</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-mark-registration-paid]").forEach(button => {
    button.addEventListener("click", () => markRegistrationPaymentPaid(button.dataset.markRegistrationPaid));
  });
  list.querySelectorAll("[data-cancel-registration-payment]").forEach(button => {
    button.addEventListener("click", () => cancelRegistrationPayment(button.dataset.cancelRegistrationPayment));
  });
}

async function markRegistrationPaymentPaid(id) {
  const reference = window.prompt("Enter the verified transaction reference:");
  if (!reference || reference.trim().length < 3) return;
  if (!window.confirm("Confirm you have verified this payment externally and want to mark it paid?")) return;
  try {
    await adminContentRequest({
      action: "admin-registration-payment-update",
      adminSessionToken: getToken(),
      id,
      status: "paid",
      paymentReference: reference.trim()
    });
    await loadRegistrationPaymentRequests();
    showManualResult("Registration fee marked paid. The user can retry signup with the same phone number.");
  } catch (error) {
    window.alert(error.message || "Unable to mark registration fee paid.");
  }
}

async function cancelRegistrationPayment(id) {
  const reason = window.prompt("Reason for cancelling this registration fee request:");
  if (!reason || reason.trim().length < 3) return;
  if (!window.confirm("Cancel this registration fee request?")) return;
  try {
    await adminContentRequest({
      action: "admin-registration-payment-update",
      adminSessionToken: getToken(),
      id,
      status: "cancelled",
      reason: reason.trim()
    });
    await loadRegistrationPaymentRequests();
  } catch (error) {
    window.alert(error.message || "Unable to cancel registration fee request.");
  }
}

async function loadUpgradeRequests() {
  const data = await adminContentRequest({
    action: "admin-upgrade-requests",
    adminSessionToken: getToken()
  });
  upgradeRequests = Array.isArray(data.requests) ? data.requests : [];
  const list = $("upgradeRequestsList");
  const empty = $("upgradeRequestsEmpty");
  $("upgradeRequestsCount").textContent = upgradeRequests.length + " pending request(s)";
  if (!upgradeRequests.length) {
    list.innerHTML = "";
    empty?.removeAttribute("hidden");
    return;
  }
  empty?.setAttribute("hidden", "");
  list.innerHTML = upgradeRequests.map(request => {
    const name = request.user?.full_name || request.user?.username || request.user?.phone || request.user_id || "Customer";
    const plan = request.plan === "business_monthly" ? "Business" : "Personal";
    return `
      <article class="upgrade-request-card">
        <div>
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(plan)} · USD ${escapeHtml(Number(request.amount).toFixed(2))}/month</span>
          <small>${escapeHtml(request.user?.phone || "Phone not available")} · ${escapeHtml(formatDate(request.created_at))}</small>
          <small>User ID: ${escapeHtml(request.user_id)} · Request: ${escapeHtml(request.id)}</small>
        </div>
        <div class="upgrade-request-actions">
          <button type="button" data-use-upgrade-request="${escapeHtml(request.id)}">Use in Manual Upgrade</button>
          <button type="button" data-close-upgrade-request="${escapeHtml(request.id)}">Close Request</button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-use-upgrade-request]").forEach(button => {
    button.addEventListener("click", () => useUpgradeRequest(button.dataset.useUpgradeRequest));
  });
  list.querySelectorAll("[data-close-upgrade-request]").forEach(button => {
    button.addEventListener("click", () => closeUpgradeRequest(button.dataset.closeUpgradeRequest));
  });
}

function useUpgradeRequest(id) {
  const request = upgradeRequests.find(item => item.id === id);
  if (!request) return;
  selectedUpgradeRequestId = request.id;
  $("customerIdentifier").value = request.user_id;
  $("upgradePlan").value = request.plan;
  $("amountReceived").value = Number(request.amount).toFixed(2);
  $("upgradeNotes").value = "Customer upgrade request " + request.id + ". Verify the actual payment before approving.";
  showManualResult("Request loaded. Verify payment externally and enter the payment method/reference before granting the upgrade.");
  $("manualUpgradeForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function closeUpgradeRequest(id) {
  const reason = window.prompt("Reason for closing this unpaid upgrade request:");
  if (!reason || reason.trim().length < 3) return;
  if (!window.confirm("Close this request without activating an upgrade?")) return;
  try {
    await adminContentRequest({
      action: "admin-upgrade-request-close",
      adminSessionToken: getToken(),
      id,
      reason: reason.trim()
    });
    if (selectedUpgradeRequestId === id) selectedUpgradeRequestId = null;
    await loadUpgradeRequests();
    await loadRegistrationPaymentRequests();
  } catch (error) {
    window.alert(error.message || "Unable to close the request.");
  }
}

async function loadAll() {
  try {
    await loadOverview();
    await loadRecords();
    applyFilters();
    await loadUpgradeRequests();
  } catch (error) {
    console.error(
      "Admin payments data load failed:",
      error
    );
  }
}

function setupEvents() {
  $("refreshBtn")?.addEventListener(
    "click",
    () => loadAll().catch(error => showManualResult(error.message, true))
  );

  $("refreshUpgradeRequests")?.addEventListener(
    "click",
    () => loadUpgradeRequests().catch(error => {
      $("upgradeRequestsCount").textContent = error.message || "Unable to load requests";
    })
  );

  $("refreshRegistrationPayments")?.addEventListener(
    "click",
    () => loadRegistrationPaymentRequests().catch(error => {
      $("registrationPaymentsCount").textContent = error.message || "Unable to load requests";
    })
  );

  $("signOutBtn")?.addEventListener(
    "click",
    secureSignOut
  );

  $("manualUpgradeForm")?.addEventListener(
    "submit",
    handleManualUpgrade
  );

  setupPlanButtons();
  setupScrollActions();
  setupPlanAmountSync();
  setupFilters();
}

async function init() {
  setupEvents();

  const valid =
    await verifyAdminSession();

  show("loadingState", false);

  if (!valid) {
    show("deniedState", true);
    show("adminContent", false);
    return;
  }

  show("deniedState", false);
  show("adminContent", true);

  await loadAll();
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
