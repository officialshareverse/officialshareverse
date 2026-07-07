const DEFAULT_CURRENCY = "INR";

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getSubscriptionName(group = {}) {
  return group.subscription_name || group.subscription || group.name || "";
}

function getGroupId(group = {}, response = {}) {
  return response.group_id || group.group_id || group.id || "";
}

function getGroupPricePaid(group = {}, response = {}) {
  return toNumber(
    response.charged_amount ?? group.charged_amount ?? group.join_price ?? group.price_paid ?? group.price_per_slot
  );
}

function buildGroupItem(group = {}, response = {}, value = 0) {
  const subscriptionName = getSubscriptionName(group) || "ShareVerse group";
  return {
    item_id: String(getGroupId(group, response) || subscriptionName),
    item_name: subscriptionName,
    item_category: response.group_mode || group.mode || group.mode_label || "",
    price: value,
    quantity: 1,
  };
}

function buildTransactionId(prefix, primaryId) {
  const idPart = primaryId || "event";
  return `${prefix}_${idPart}_${Date.now()}`;
}

export function pushDataLayerEvent(event, params = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
  });
}

export function trackSignup(method = "email", params = {}) {
  pushDataLayerEvent("sign_up", {
    method,
    ...params,
  });
}

export function trackLogin(method = "email") {
  pushDataLayerEvent("login", { method });
}

export function trackGroupCreated(group = {}, response = {}) {
  const planPrice = toNumber(group.price_per_slot ?? group.plan_price);
  const slots = toNumber(group.total_slots ?? group.slots);
  pushDataLayerEvent("create_group", {
    subscription_name: getSubscriptionName(group),
    group_id: response.group_id || group.group_id || "",
    group_mode: group.mode || "",
    plan_price: planPrice,
    slots,
    value: planPrice * slots,
    currency: DEFAULT_CURRENCY,
  });
}

export function trackGroupJoined(group = {}, response = {}) {
  const pricePaid = getGroupPricePaid(group, response);
  pushDataLayerEvent("join_group", {
    subscription_name: getSubscriptionName(group),
    group_id: getGroupId(group, response),
    group_mode: response.group_mode || group.mode || "",
    price_paid: pricePaid,
    currency: DEFAULT_CURRENCY,
  });
}

export function trackPurchase(group = {}, response = {}) {
  const value = getGroupPricePaid(group, response);
  const groupId = getGroupId(group, response);
  pushDataLayerEvent("purchase", {
    transaction_id: response.transaction_id || response.payment_id || buildTransactionId("group_join", groupId),
    value,
    currency: DEFAULT_CURRENCY,
    group_id: groupId,
    items: [buildGroupItem(group, response, value)],
  });
}

export function trackMoneyAdded({ amount, currency, paymentResponse = {}, verifyResponse = {}, orderResponse = {} } = {}) {
  const topup = verifyResponse.topup || orderResponse.topup || {};
  pushDataLayerEvent("add_money", {
    transaction_id: paymentResponse.razorpay_payment_id || topup.provider_payment_id || topup.id || "",
    value: toNumber(topup.amount ?? amount),
    currency: currency || topup.currency || orderResponse.checkout?.currency || DEFAULT_CURRENCY,
    payment_provider: "razorpay",
  });
}

export function trackSubscriptionActivated(group = {}) {
  pushDataLayerEvent("subscription_activated", {
    subscription_name: getSubscriptionName(group),
    group_id: group.group_id || group.id || "",
    group_mode: group.mode || "",
  });
}
