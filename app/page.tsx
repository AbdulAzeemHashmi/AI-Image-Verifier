'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Connect Frontend to your public Supabase configurations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ real: number; ai: number } | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      // 1. Upload file directly into your Supabase public bucket folder
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('user-images').upload(fileName, file);
      
      if (error) throw error;

      // 2. Get the permanent web link for that uploaded image
      const { data: { publicUrl } } = supabase.storage.from('user-images').getPublicUrl(data.path);

      // 3. Pass the web link to our hidden backend API route
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });
      
      const analysis = await response.json();
      
      if (analysis.error) {
        alert(analysis.error);
      } else {
        setResult(analysis);
      }
    } catch (err: any) {
  // This will display the exact error message on your screen!
  alert("Error Details: " + (err.message || JSON.stringify(err)));
} finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-xl text-center border border-slate-700">
        <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-blue-400">AI Image Detector</h1>
        <p className="text-slate-400 text-sm mb-6">Upload an image to see its real vs fake probability score.</p>

        <label className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group mb-6">
          <span className="text-sm font-medium text-slate-300 group-hover:text-blue-400">
            {loading ? "AI is processing image..." : "📸 Click to upload image"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={loading} />
        </label>

        {result && (
          <div className="space-y-4 pt-2">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-emerald-400">Real: {result.real}%</span>
              <span className="text-rose-400">AI Generated: {result.ai}%</span>
            </div>
            <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden flex">
              <div style={{ width: `${result.real}%` }} className="bg-emerald-500 h-full transition-all" />
              <div style={{ width: `${result.ai}%` }} className="bg-rose-500 h-full transition-all" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
