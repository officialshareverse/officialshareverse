export const HOME_ACTIVATION_VERSION = "v1";

const ACTIVATION_TEMPLATES = {
  sharing: [
    {
      id: "team-software",
      label: "Team software",
      description: "A shared workspace or tool you already manage.",
      suggestionName: "Team software workspace",
      totalSlots: "4",
      pricePerSlot: "249",
    },
    {
      id: "cloud-storage",
      label: "Cloud storage",
      description: "An existing storage plan with a few open spots.",
      suggestionName: "Cloud storage circle",
      totalSlots: "3",
      pricePerSlot: "149",
    },
    {
      id: "learning-membership",
      label: "Learning membership",
      description: "A course or membership cycle you already pay for.",
      suggestionName: "Learning membership circle",
      totalSlots: "5",
      pricePerSlot: "199",
    },
  ],
  group_buy: [
    {
      id: "team-software-buy",
      label: "Team software",
      description: "Collect commitments before the tool is purchased.",
      suggestionName: "Team software starter group",
      totalSlots: "4",
      pricePerSlot: "299",
    },
    {
      id: "cloud-storage-buy",
      label: "Cloud storage",
      description: "Pool contributions for a shared storage upgrade.",
      suggestionName: "Cloud storage upgrade group",
      totalSlots: "3",
      pricePerSlot: "179",
    },
    {
      id: "learning-membership-buy",
      label: "Learning membership",
      description: "Start a buy-together cohort for a learning plan.",
      suggestionName: "Learning membership circle",
      totalSlots: "6",
      pricePerSlot: "249",
    },
  ],
};

export function getActivationTemplatesForPath(path) {
  return ACTIVATION_TEMPLATES[path] || [];
}

export function getActivationTemplateById(path, templateId) {
  return getActivationTemplatesForPath(path).find((item) => item.id === templateId) || null;
}

export function getActivationPrefillFromState(state) {
  if (!state || state.activationEntry !== "home-activation") {
    return null;
  }

  const path = state.activationPath;
  if (path !== "sharing" && path !== "group_buy") {
    return null;
  }

  const template =
    getActivationTemplateById(path, state.activationTemplateId) ||
    getActivationTemplatesForPath(path)[0] ||
    null;

  if (!template) {
    return null;
  }

  return {
    mode: path,
    template,
    formDefaults: {
      subscription_name: template.suggestionName,
      total_slots: template.totalSlots,
      price_per_slot: template.pricePerSlot,
    },
  };
}
