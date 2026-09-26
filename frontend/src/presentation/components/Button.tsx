import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cx } from "../class-names";
import styles from "./Button.module.css";

type Variant = "primary" | "quiet" | "link";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "primary", type = "button", className, ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles.button, styles[variant], className)} {...rest} />;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant };

export function ButtonLink({ variant = "primary", className, ...rest }: ButtonLinkProps) {
  return <a className={cx(styles.button, styles[variant], styles.asLink, className)} {...rest} />;
}
