import { StudentDetailScreen } from "@/components/student/student-detail";

export default async function StudentPage(props: PageProps<"/students/[id]">) {
  const { id } = await props.params;
  return <StudentDetailScreen id={id} />;
}
