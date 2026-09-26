import type { HTMLAttributes } from "react";
import { cx } from "../class-names";
import styles from "./GlassPanel.module.css";

type Props = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "aside" | "header";
  tone?: "clear" | "alert";
};

export function GlassPanel({ as: Element = "div", tone = "clear", className, ...rest }: Props) {
  return <Element className={cx(styles.panel, tone === "alert" && styles.alert, className)} {...rest} />;
}
