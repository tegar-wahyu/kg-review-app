import ReviewApp from "@/components/ReviewApp";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <ReviewApp courseId={courseId} />;
}
