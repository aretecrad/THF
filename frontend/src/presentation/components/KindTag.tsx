import type { ListingKind } from "@/domain/listing";
import { cx } from "../class-names";
import { KIND_LABEL } from "../copy";
import styles from "./KindTag.module.css";

const TONE: Readonly<Record<ListingKind, string | undefined>> = { sale: styles.sale, rent: styles.rent, "sale/rent": undefined };

export function KindTag({ kind }: { kind: ListingKind }) {
  return <span className={cx(styles.tag, TONE[kind])}>{KIND_LABEL[kind]}</span>;
}
