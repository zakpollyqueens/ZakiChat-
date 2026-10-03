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

  const data =
    await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error_description ||
      data?.hint ||
      data?.details ||
      data?.error ||
      "Supabase RPC request failed."
    );
  }

  return data;
}

async function verifyAdminSession() {
  const token = getToken();

  if (!token) return false;

  const expiry =
    Number(localStorage.getItem(EXPIRY_KEY) || 0);

  if (expiry && Date.now() >= expiry) {
    clearAdminSession();
    return false;
  }

  try {
    const adminId = await rpc(
      "admin_session_user",
      { p_token: token }
    );

    if (!adminId) {
      clearAdminSession();
      return false;
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
          action: "admin-session-revoke"
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

async function loadAll() {
  try {
    await loadOverview();
    await loadRecords();
    applyFilters();
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
    () => location.reload()
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
