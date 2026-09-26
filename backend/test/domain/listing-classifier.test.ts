import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPost, extractPrice } from "../../src/domain/listing-classifier.js";

describe("classifyPost", () => {
  it("recognises sale, rent and combined offers", () => {
    assert.deepEqual(classifyPost("Dijual rumah di Depok, 900jt"), { type: "offer", kind: "sale" });
    assert.deepEqual(classifyPost("Disewakan rumah di Kemang. 150jt/thn"), { type: "offer", kind: "rent" });
    assert.deepEqual(classifyPost("House for rent in Canggu, $2,500/mo"), { type: "offer", kind: "rent" });
    assert.deepEqual(classifyPost("Dijual / disewakan rumah di Kelapa Gading"), { type: "offer", kind: "sale/rent" });
    assert.deepEqual(classifyPost("Ada kak, kontrakan 2 kamar di Kemang 1,8jt/bln"), { type: "offer", kind: "rent" });
  });

  it("recognises people looking for a house", () => {
    assert.deepEqual(classifyPost("Lagi cari kontrakan di Depok budget 2jt/bln, ada info?"), { type: "wanted" });
    assert.deepEqual(classifyPost("Mau sewa rumah di BSD, ada rekomendasi?"), { type: "wanted" });
  });

  it("keeps offers that mention buyers who are looking", () => {
    assert.deepEqual(classifyPost("Dijual rumah, cocok buat yang cari hunian pertama"), { type: "offer", kind: "sale" });
  });

  it("treats everything else as unrelated, including short questions in comments", () => {
    assert.deepEqual(classifyPost("Tips beli properti pertama buat pemula"), { type: "unrelated" });
    assert.deepEqual(classifyPost("Harga berapa kak? Masih ada?"), { type: "unrelated" });
  });
});

describe("extractPrice", () => {
  const examples: ReadonlyArray<readonly [string, string]> = [
    ["LT 120m2, Harga 2,1M nego", "2,1M"],
    ["Rumah di Kemang. Rp 4,5 M. SHM", "Rp 4,5 M"],
    ["3 kamar. 150jt/thn. DM ya", "150jt/thn"],
    ["Kontrakan 1,5jt/bln hub WA", "1,5jt/bln"],
    ["3BR with pool, $2,500/mo", "$2,500/mo"],
  ];
  for (const [text, price] of examples) {
    it(`finds "${price}"`, () => assert.equal(extractPrice(text), price));
  }

  it("doesn't mistake land and building sizes for prices", () => {
    assert.equal(extractPrice("LT 120m2 / LB 90m2, 3KT 2KM"), undefined);
  });
});
