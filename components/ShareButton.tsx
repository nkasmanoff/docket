"use client";
import { usePathname } from "next/navigation";
import { Button } from "./Button";
import { useToast } from "./Toast";
import { buildShareText, ShareOpts } from "@/lib/share";

export function ShareButton({ share }: { share: ShareOpts }) {
  const toast = useToast();
  const pathname = usePathname();

  const onShare = async () => {
    const gameUrl =
      typeof window !== "undefined" && pathname.startsWith("/games/")
        ? `${window.location.origin}${pathname}`
        : undefined;
    const text = buildShareText({ ...share, gameUrl });
    try {
      // Prefer the native share sheet on mobile.
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.show("Copied!");
    } catch {
      toast.show("Couldn't copy");
    }
  };

  return (
    <Button onClick={onShare} className="w-full">
      Share result
    </Button>
  );
}
