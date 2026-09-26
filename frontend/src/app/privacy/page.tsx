import type { Metadata } from "next";
import styles from "./privacy.module.css";

export const metadata: Metadata = { title: "Privacy and data deletion | Threads house finder" };

const CONTACT_EMAIL = process.env.PRIVACY_CONTACT_EMAIL;

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <p className={styles.back}>
          <a href="/">Back to the dashboard</a>
        </p>
        <h1>Privacy and data deletion</h1>
        <p>
          Threads house finder helps you find houses for sale and rent that people post publicly on Threads, and ranks
          them by distance from a place you choose.
        </p>

        <h2>What the app accesses</h2>
        <ul>
          <li>Your Threads username, name and profile picture, to show who is logged in.</li>
          <li>
            Public Threads posts and comments that match house-listing searches, found using your account through
            Meta&apos;s official Threads API.
          </li>
        </ul>
        <p>The app never posts, replies, likes or sends messages for you, and it can&apos;t see private content.</p>

        <h2>What the app stores</h2>
        <ul>
          <li>Your account details listed above.</li>
          <li>Your Threads access token, encrypted, so searches can run for you. It expires if it isn&apos;t renewed.</li>
          <li>
            The listings found for you, held in the server&apos;s memory only and gone when it restarts. Other users
            can&apos;t see them.
          </li>
        </ul>
        <p>Nothing is sold, shared for advertising, or used to build profiles.</p>

        <h2>Other services</h2>
        <p>
          Place names mentioned in listings, and addresses you type, are sent to OpenStreetMap&apos;s geocoder to find
          their coordinates. Your browser loads map images from OpenStreetMap.
        </p>

        <h2>How to delete your data</h2>
        <ol>
          <li>
            In the dashboard, open the account menu (your picture, top left) and choose <strong>Delete my data</strong>.
            Your account, access token and saved listings are deleted immediately, and you get a confirmation code.
          </li>
          <li>
            Or remove the app from your Threads account settings and request deletion there. Meta forwards the request
            and the same deletion happens automatically.
          </li>
          {CONTACT_EMAIL && (
            <li>
              Or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </li>
          )}
        </ol>
      </article>
    </main>
  );
}
