export async function uploadToCloudinary(file: File): Promise<string> {
  const data = new FormData();
  data.append('file', file);
  data.append('upload_preset', 'unsigned_preset');

  const res = await fetch('https://api.cloudinary.com/v1_1/djmcneuub/image/upload', {
    method: 'POST',
    body: data,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error.message || 'Errore upload Cloudinary');

  return json.secure_url;
}
