// Re-mounts on every navigation, so the `page-enter` fade plays on each route
// change. `flex flex-1 flex-col` preserves the layout's full-height flex chain
// (pages rely on flex-1 / min-h-screen). Opacity-only animation keeps fixed
// overlays anchored to the viewport.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
