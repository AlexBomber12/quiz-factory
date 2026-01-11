import { add } from "../lib/add";

export default function HomePage() {
  return (
    <section>
      <h1>Quiz Factory</h1>
      <p>Next.js 16 + TypeScript + Turborepo bootstrap is ready.</p>
      <p>
        Sanity check: <code>2 + 2 = {add(2, 2)}</code>
      </p>
    </section>
  );
}
