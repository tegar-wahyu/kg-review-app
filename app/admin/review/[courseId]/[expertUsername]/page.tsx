import ReviewApp from "@/components/ReviewApp";

export default async function AdminExpertResponsePage({
  params,
}: {
  params: Promise<{ courseId: string; expertUsername: string }>;
}) {
  const { courseId, expertUsername } = await params;
  return <ReviewApp courseId={courseId} readOnly expertUsername={expertUsername} />;
}
