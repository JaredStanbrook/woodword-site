import { describe, it, expect } from "vitest";

import { DELIVERY_OPTIONS, deliversTo, isWesternAustralia } from "../worker/config/shop.config";
import { checkoutFormSchema } from "../worker/schema/shop.schema";

/**
 * Mooihout sells within Western Australia only, and delivers within Perth and
 * Peel only; elsewhere in WA, the piece is collected from the workshop.
 */

const form = (over: Record<string, string> = {}) => ({
  name: "Sam Reader",
  email: "sam@example.com",
  line1: "1 Hay Street",
  city: "Perth",
  postcode: "6000",
  delivery: "standard",
  ...over,
});

describe("where Mooihout sells", () => {
  it("takes orders from WA postcodes only", () => {
    expect(checkoutFormSchema.safeParse(form()).success).toBe(true);
    for (const postcode of ["2000", "3000", "0800", "5000"]) {
      const r = checkoutFormSchema.safeParse(form({ postcode }));
      expect(r.success, postcode).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toMatch(/Western Australia/);
    }
    expect(checkoutFormSchema.safeParse(form({ postcode: "60" })).success).toBe(false);
    expect(isWesternAustralia("6530")).toBe(true);
    expect(isWesternAustralia("2000")).toBe(false);
  });

  it("always records the state and country as WA, Australia", () => {
    const r = checkoutFormSchema.safeParse(form({ region: "NSW", country: "France" }));
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.region, r.data.country]).toEqual(["WA", "Australia"]);
  });
});

describe("where Mooihout delivers", () => {
  it("delivers to Perth and Peel", () => {
    for (const postcode of [
      "6000", // Perth
      "6027", // Joondalup
      "6037", // Two Rocks
      "6084", // Bullsbrook
      "6112", // Armadale
      "6122", // Byford
      "6160", // Fremantle
      "6180", // Lakelands, Mandurah
      "6208", // Pinjarra
      "6210", // Mandurah
      "6211", // Dawesville
      "6213", // Dwellingup
      "6215", // Waroona
      "6390", // Boddington
      "6556", // Chidlow
    ]) {
      expect(deliversTo(postcode), postcode).toBe(true);
    }
  });

  it("does not deliver elsewhere in WA, or to Rottnest", () => {
    for (const postcode of [
      "6161", // Rottnest: no road
      "6230", // Bunbury
      "6280", // Busselton
      "6330", // Albany
      "6430", // Kalgoorlie
      "6530", // Geraldton
      "6725", // Broome
      "6892", // a PO box
    ]) {
      expect(deliversTo(postcode), postcode).toBe(false);
    }
  });

  it("offers collection without an area limit, and delivery only within it", () => {
    const collect = DELIVERY_OPTIONS.find((d) => d.id === "collect")!;
    expect(collect.needsDeliveryArea).toBeFalsy();
    for (const d of DELIVERY_OPTIONS.filter((d) => d.id !== "collect"))
      expect(d.needsDeliveryArea, d.id).toBe(true);
  });
});
