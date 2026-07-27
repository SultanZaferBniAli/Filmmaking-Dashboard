import UploadReviewPanel from '../components/admin/UploadReviewPanel';
import ImageManager from '../components/admin/ImageManager';
import { useAuth } from '../state/AuthContext';

export default function AdminPage() {
  const { isAdmin } = useAuth();

  // The sidebar already hides this tab from viewers, and every route it calls is gated
  // server-side — this is just a defense-in-depth fallback against stale client state.
  if (!isAdmin) {
    return (
      <main className="mx-auto flex w-full max-w-[1600px] flex-col px-6 pb-10 md:px-10">
        <p className="text-right text-sm text-notif-red">غير مصرح لك بالوصول إلى هذه الصفحة.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-6 pb-10 md:px-10">
      <UploadReviewPanel />
      <ImageManager />
    </main>
  );
}
