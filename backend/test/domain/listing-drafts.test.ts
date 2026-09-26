import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftListings, isMissingDetails } from "../../src/domain/listing-drafts.js";
import { aComment, aPost } from "../support/fakes.js";

const summary = (drafts: ReturnType<typeof draftListings>) =>
  drafts.map((d) => ({ id: d.source.id, origin: d.origin, kind: d.kind, price: d.price, places: d.placeHints }));

describe("draftListings", () => {
  it("fills a missing price and place from the seller's own comments", () => {
    const post = aPost({ id: "p", text: "Dijual rumah 2 lantai, SHM. Harga via komen", author: "seller" });
    const comments = [
      aComment({ id: "c1", text: "Harga berapa kak? Lokasinya dimana?", author: "buyer" }),
      aComment({ id: "c2", text: "Harga 1,1M nego kak", author: "seller" }),
      aComment({ id: "c3", text: "Depok kak", author: "seller" }),
    ];
    assert.deepEqual(summary(draftListings(post, comments)), [
      { id: "p", origin: "post", kind: "sale", price: { value: "1,1M", source: "comment" }, places: [{ name: "Depok", source: "comment" }] },
    ]);
  });

  it("prefers details in the listing itself over later comments", () => {
    const post = aPost({ id: "p", text: "Disewakan rumah di Kemang, 150jt/thn", author: "seller" });
    const comments = [aComment({ id: "c", text: "Bisa 140jt/thn kak, lokasi: Kemang Timur", author: "seller" })];
    const [draft] = draftListings(post, comments);
    assert.deepEqual(draft.price, { value: "150jt/thn", source: "text" });
    assert.deepEqual(draft.placeHints[0], { name: "Kemang", source: "text" });
  });

  it("never takes details from other people's comments", () => {
    const post = aPost({ id: "p", text: "Dijual rumah siap huni, info DM", author: "seller" });
    const comments = [aComment({ id: "c", text: "Di Bekasi ya kak? 500jt?", author: "buyer" })];
    const [draft] = draftListings(post, comments);
    assert.equal(draft.price, undefined);
    assert.deepEqual(draft.placeHints, []);
    assert.equal(isMissingDetails(draft), true);
  });

  it("turns offers left as comments on a 'looking for' post into listings", () => {
    const post = aPost({ id: "p", text: "Lagi cari kontrakan di Depok budget 2jt/bln", author: "seeker" });
    const comments = [
      aComment({ id: "c1", text: "Ada kak, kontrakan 2 kamar di Margonda 1,8jt/bln", author: "owner" }),
      aComment({ id: "c2", text: "Masih ada kak?", author: "seeker" }),
      aComment({ id: "c3", text: "Masih kak, lokasi: Margonda Raya", author: "owner" }),
      aComment({ id: "c4", text: "Ikut nyimak", author: "someone" }),
    ];
    assert.deepEqual(summary(draftListings(post, comments)), [
      {
        id: "c1",
        origin: "comment",
        kind: "rent",
        price: { value: "1,8jt/bln", source: "text" },
        places: [{ name: "Margonda", source: "text" }, { name: "Margonda Raya", source: "comment" }],
      },
    ]);
  });

  it("finds nothing in unrelated posts", () => {
    assert.deepEqual(draftListings(aPost({ id: "p", text: "Tips dekorasi ruang tamu" })), []);
  });
});
