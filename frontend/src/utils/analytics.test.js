import {
  trackGroupCreated,
  trackGroupJoined,
  trackLogin,
  trackMoneyAdded,
  trackPurchase,
  trackSignup,
  trackSubscriptionActivated,
} from "./analytics";

beforeEach(() => {
  window.dataLayer = [];
  jest.spyOn(Date, "now").mockReturnValue(1234567890);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("pushes ShareVerse funnel events to the data layer", () => {
  const group = {
    id: 42,
    subscription_name: "Spotify Family",
    mode: "sharing",
    price_per_slot: "149.00",
  };
  const joinResponse = {
    group_id: 42,
    charged_amount: "156.45",
    group_mode: "sharing",
  };

  trackSignup("email", { has_referral: false });
  trackLogin("google");
  trackGroupCreated(
    { subscription_name: "Spotify Family", mode: "sharing", price_per_slot: "149", total_slots: "4" },
    { group_id: 42 }
  );
  trackGroupJoined(group, joinResponse);
  trackMoneyAdded({ amount: "500", paymentResponse: { razorpay_payment_id: "pay_1" } });
  trackPurchase(group, joinResponse);
  trackSubscriptionActivated(group);

  expect(window.dataLayer).toEqual([
    { event: "sign_up", method: "email", has_referral: false },
    { event: "login", method: "google" },
    {
      event: "create_group",
      subscription_name: "Spotify Family",
      group_id: 42,
      group_mode: "sharing",
      plan_price: 149,
      slots: 4,
      value: 596,
      currency: "INR",
    },
    {
      event: "join_group",
      subscription_name: "Spotify Family",
      group_id: 42,
      group_mode: "sharing",
      price_paid: 156.45,
      currency: "INR",
    },
    {
      event: "add_money",
      transaction_id: "pay_1",
      value: 500,
      currency: "INR",
      payment_provider: "razorpay",
    },
    {
      event: "purchase",
      transaction_id: "group_join_42_1234567890",
      value: 156.45,
      currency: "INR",
      group_id: 42,
      items: [
        {
          item_id: "42",
          item_name: "Spotify Family",
          item_category: "sharing",
          price: 156.45,
          quantity: 1,
        },
      ],
    },
    {
      event: "subscription_activated",
      subscription_name: "Spotify Family",
      group_id: 42,
      group_mode: "sharing",
    },
  ]);
});