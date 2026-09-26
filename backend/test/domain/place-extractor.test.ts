import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPlaceCandidates } from "../../src/domain/place-extractor.js";

describe("extractPlaceCandidates", () => {
  const examples: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["DIJUAL RUMAH\nLokasi: Bintaro Sektor 9, Tangsel\nHarga 2,1M", ["Bintaro Sektor 9, Tangerang Selatan", "Bintaro Sektor 9"]],
    ["Disewakan rumah di Kemang, Jakarta Selatan. 3 kamar", ["Kemang, Jakarta Selatan", "Kemang"]],
    ["Rumah dijual cepat di jl. Kemang Raya no 12, Jaksel. Rp 4,5 M", ["Jalan Kemang Raya"]],
    ["di jual rumah murah di depok 900jt, hub 08123456789", ["depok"]],
    ["Rumah dijual di bawah harga pasar, lokasi strategis di Cibubur", ["Cibubur"]],
    ["Disewakan rumah dekat jalan raya, 3,5 juta/bln, area Ciputat", ["Ciputat"]],
    ["Kontrakan murah di Tangsel, 1,5jt/bln hub WA", ["Tangerang Selatan"]],
    ["Dijual Rumah Cluster Asri Bintaro Jaya 🏡 Harga mulai 1,5M", ["Bintaro Jaya"]],
    ["House for rent in Canggu, Bali — 3BR with pool", ["Canggu, Bali", "Canggu"]],
    ["Lokasinya di Depok kak, harga 850jt", ["Depok"]],
  ];

  for (const [text, expected] of examples) {
    it(`reads ${JSON.stringify(expected[0])} from "${text.split("\n")[0].slice(0, 40)}…"`, () => {
      assert.deepEqual(extractPlaceCandidates(text), expected);
    });
  }

  it("returns nothing when the post names no place", () => {
    assert.deepEqual(extractPlaceCandidates("Dijual rumah siap huni, info DM"), []);
  });
});

describe("extractPlaceCandidates on short comment answers", () => {
  const answer = (text: string) => extractPlaceCandidates(text, { allowBareAnswer: true });

  it("reads a place given as a bare answer", () => {
    assert.deepEqual(answer("Depok kak"), ["Depok"]);
    assert.deepEqual(answer("Bintaro sektor 9 ya kak"), ["Bintaro sektor 9"]);
    assert.deepEqual(answer("Jaksel kak"), ["Jakarta Selatan"]);
  });

  it("ignores everyday replies", () => {
    for (const text of ["Masih kak", "Sudah terjual ya", "Boleh nego kak", "DM ya", "850jt kak", "Ready kak"]) {
      assert.deepEqual(answer(text), [], text);
    }
  });

  it("only reads bare answers when asked to", () => {
    assert.deepEqual(extractPlaceCandidates("Depok kak"), []);
  });
});
