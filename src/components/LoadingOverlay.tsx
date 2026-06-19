type LoadingOverlayProps = {
  message: string;
};

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="rounded-pill border border-ink bg-paper px-6 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-ink">
        {message}
      </div>
    </div>
  );
}
