import { Suspense } from "react";
import { StudentList } from "@/components/dashboard/student-list";
import { ListSkeleton } from "@/components/ui/skeleton";

/**
 * The roster, on its own page.
 *
 * The same list the dashboard shows, moved to its own route because it is a place
 * people spend time rather than glance at, and because an admin looking for one
 * student should be able to link to them. The header summary, the per-row actions
 * and the filters are rebuilt for this page in a later phase; until then it is
 * the existing component rather than a second, worse one.
 */
export default function StudentsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={8} />}>
      <StudentList />
    </Suspense>
  );
}