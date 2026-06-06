import { LoadingState } from "@/components/loading-state";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-8">
      <LoadingState label="Loading feedback form" />
    </main>
  );
}
