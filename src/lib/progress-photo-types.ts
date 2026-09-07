// Pure types/constants shared between the server-only storage module
// (src/lib/progress-photo-storage.ts, which touches the filesystem) and
// client components — kept in their own file so a "use client" component
// can import the angle labels without pulling Node's fs/path into the
// browser bundle.
export type PhotoAngle = "FRONT" | "SIDE" | "BACK";
export const PHOTO_ANGLES: PhotoAngle[] = ["FRONT", "SIDE", "BACK"];
export const PHOTO_ANGLE_LABEL: Record<PhotoAngle, string> = { FRONT: "ด้านหน้า", SIDE: "ด้านข้าง", BACK: "ด้านหลัง" };

export function angleField(angle: PhotoAngle): "frontPhotoPath" | "sidePhotoPath" | "backPhotoPath" {
  return angle === "FRONT" ? "frontPhotoPath" : angle === "SIDE" ? "sidePhotoPath" : "backPhotoPath";
}
