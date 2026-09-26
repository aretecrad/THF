import styles from "./Brand.module.css";

export function Brand({ as: Heading = "h1", id }: { as?: "h1" | "p"; id?: string }) {
  return (
    <Heading id={id} className={styles.brand}>
      Threads house finder
    </Heading>
  );
}
