import { uploadWorkshopPhotosAdmin, AdminApiError } from '../data/admin';

export class PhotoUploadError extends Error {}

// Uploads photo files via the dedicated admin photo route (writes the files under the flat
// import-data/workshops/photos/ layout and updates the workshop's cover image in one call).
export async function uploadWorkshopPhotos(workshopId: string, files: File[]): Promise<void> {
  try {
    await uploadWorkshopPhotosAdmin(workshopId, files);
  } catch (err) {
    throw new PhotoUploadError(err instanceof AdminApiError ? err.message : `تعذّر رفع الصور (${files.length})`);
  }
}
