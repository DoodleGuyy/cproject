'use client';

import React, { useState } from 'react';
import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';


const validCounts = [2, 4, 6, 8, 16, 32, 64, 128, 256];

type ImageItem = {
  file: File;
  preview: string;
  name: string;
};

export default function CreatePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const imageItems = selectedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        name: file.name.replace(/\.[^/.]+$/, ''), // nome pulito
      }));
      setImages(imageItems);
      setError('');
    }
  };

  const handleNameChange = (index: number, newName: string) => {
    const updatedImages = [...images];
    updatedImages[index].name = newName;
    setImages(updatedImages);
  };



const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validCounts.includes(images.length)) {
    setError('Carica un numero di immagini valido: 2, 4, 6, 8, 16, 32, 64, 128, 256');
    return;
  }

  setUploading(true);
  setError('');

  try {
    const uploaded = [];

    for (const img of images) {
      // Carico su Cloudinary e prendo l'URL
      const url = await uploadToCloudinary(img.file);
      uploaded.push({ url, name: img.name });
    }

    await addDoc(collection(db, 'classifiche'), {
      title,
      description,
      images: uploaded,
      createdAt: Timestamp.now(),
    });

    setTitle('');
    setDescription('');
    setImages([]);
    alert('Classifica creata con successo!');
  } catch (err) {
    console.error('Errore durante la creazione:', err);
    setError('Errore durante il caricamento o il salvataggio. Riprova.');
  } finally {
    setUploading(false);
  }
};


  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Crea una nuova classifica</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Titolo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <textarea
          placeholder="Descrizione"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <div className="w-full">
          <label
            htmlFor="image-upload"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded cursor-pointer"
          >
            📁 Scegli Immagini
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {images.length > 0 && (
          <div className="mt-4 space-y-4">
            {images.map((img, index) => (
              <div key={index} className="flex items-center gap-4">
                <img src={img.preview} alt={`img-${index}`} className="w-20 h-20 object-cover rounded" />
                <input
                  type="text"
                  value={img.name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  className="flex-1 p-2 border rounded"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={uploading}
        >
          {uploading ? 'Caricamento...' : 'Crea Classifica'}
        </button>
      </form>
    </div>
  );
}

