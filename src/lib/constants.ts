const isApple =
  typeof navigator !== "undefined" &&
  (/Mac|iPhone|iPod|iPad/i.test(navigator.platform) || navigator.userAgent.includes("Mac"));

/** Space below macOS traffic lights / overlay titlebar. */
export const TOP_SAFE_AREA_PADDING = isApple ? "pt-14" : "pt-8";

export const BOTTOM_SAFE_AREA_PADDING = "pb-14";

/** Left inset so content doesn’t sit under traffic lights when sidebar is absent. */
export const TRAFFIC_LIGHT_INSET = isApple ? "pl-[76px]" : "";
