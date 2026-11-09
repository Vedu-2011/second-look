import type { Metadata } from "next";
import { CheckFlow } from "./check-flow";

export const metadata: Metadata = { title: "Check a bottle" };

export default function CheckPage() {
  return (
    <div className="mx-auto w-full max-w-[45rem] px-5 pt-8 sm:px-8 sm:pt-12">
      <CheckFlow />
    </div>
  );
}
