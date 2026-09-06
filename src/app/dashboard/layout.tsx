import { BottomNav } from "./bottom-nav";

// Shared shell for every /dashboard/* page — adds the fixed bottom
// navigation and enough bottom padding that it never covers the last bit
// of a page's content (the padding accounts for the safe-area inset too,
// same as the nav bar itself, so it still clears the bar on notched phones).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {children}
      <BottomNav />
    </div>
  );
}
