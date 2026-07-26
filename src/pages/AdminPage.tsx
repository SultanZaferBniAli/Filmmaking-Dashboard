import UploadReviewPanel from '../components/admin/UploadReviewPanel';
import ImageManager from '../components/admin/ImageManager';

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-6 pb-10 md:px-10">
      <UploadReviewPanel />
      <ImageManager />
    </main>
  );
}
