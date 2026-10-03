"use strict";

const FUNCTION_URL =
  "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

const UPGRADE_FUNCTION_URL =
  "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/admin-upgrades";

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

async function verifyAdminSession() {
  const token = getToken();

  if (!token) return false;

  const expiry = Number(localStorage.getItem(EXPIRY_KEY) || 0);

  if (expiry && Date.now() >= expiry) {
    clearAdminSession();
    return false;
  }

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        action: "admin-session-verify"
      })
    });

    if (!response.ok) {
      clearAdminSession();
      return false;
    }

    const data = await response.json();

    if (!data?.valid) {
      clearAdminSession();
      return false;
    }

    if (data.expires_at) {
      localStorage.setItem(
        EXPIRY_KEY,
        String(new Date(data.expires_at).getTime())
      );
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

function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EXPIRY_KEY);
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

  const amountField = $("amountReceived");

  if (amountField) {
    amountField.value = amount;
  }
}

function setupPlanButtons() {
  document.querySelectorAll(".plan-select").forEach(button => {
    button.addEventListener("click", () => {
      selectPlan(button.dataset.plan);
    });
  });
}

function setupScrollActions() {
  document.querySelectorAll("[data-scroll]").forEach(button => {
    button.addEventListener("click", () => {
      const target = document.getElementById(
        button.dataset.scroll
      );

      target?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  });
}

function setupPlanAmountSync() {
  $("upgradePlan")?.addEventListener(
    "change",
    event => {
      const amountField = $("amountReceived");

      if (!amountField) return;

      amountField.value =
        event.target.value === "business_monthly"
          ? "10.00"
          : "2.00";
    }
  );
}

function showManualResult(message, error = false) {
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
    button?.textContent || "Upgrade Account";

  if (button) {
    button.disabled = true;
    button.textContent = "Processing Upgrade...";
  }

  showManualResult(
    "Verifying customer and processing the secure upgrade..."
  );

  try {
    const response = await fetch(
      UPGRADE_FUNCTION_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "manual-upgrade",
          adminSessionToken: token,
          email: identifier,
          phone: identifier,
          plan,
          amount: numericAmount,
          paymentMethod: method,
          reference,
          notes
        })
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
        "The secure upgrade service rejected the request."
      );
    }

    const user = data.user || {};
    const upgrade = data.upgrade || {};
    const payment = data.payment || {};

    const expiry = upgrade.expiresAt
      ? new Date(upgrade.expiresAt)
      : null;

    const expiryText =
      expiry && !Number.isNaN(expiry.getTime())
        ? expiry.toLocaleString()
        : "recorded";

    showManualResult(
      `Upgrade successful. ${
        user.email ||
        user.phone ||
        user.username ||
        "Customer"
      } now has ${
        upgrade.plan === "business_monthly"
          ? "Business"
          : "Personal"
      } access until ${expiryText}. Payment recorded as ${payment.status || "paid"}.`
    );

    event.target.reset();

    const amountField = $("amountReceived");

    if (amountField) {
      amountField.value = "2.00";
    }

    console.info(
      "Secure manual upgrade completed:",
      data
    );
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
      button.textContent = originalText;
    }
  }
}

function setupFilters() {
  const filter = () => {
    const query =
      $("recordSearch")
        ?.value
        .toLowerCase()
        .trim() || "";

    const type =
      $("recordType")?.value || "all";

    const status =
      $("recordStatus")?.value || "all";

    document.querySelectorAll(".record").forEach(record => {
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
        !(matchesQuery && matchesStatus && matchesType)
      );
    });
  };

  $("recordSearch")?.addEventListener(
    "input",
    filter
  );

  $("recordType")?.addEventListener(
    "change",
    filter
  );

  $("recordStatus")?.addEventListener(
    "change",
    filter
  );
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
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
