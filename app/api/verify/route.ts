import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Connect to your Supabase Database securely using private credentials
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();
    console.log("📥 TRACKER 1: Received Image URL ->", imageUrl);

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is missing' }, { status: 400 });
    }

    console.log("⏳ TRACKER 2: Attempting to download image from Supabase...");
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    console.log("✅ TRACKER 3: Image downloaded successfully! Size:", imageBlob.size);

    console.log("⏳ TRACKER 4: Sending image blob to Hugging Face AI...");
    // UPDATED: Using a model natively supported by the serverless hf-inference provider router
    const hfResponse = await fetch(
      "https://router.huggingface.co/hf-inference/models/umm-maybe/AI-image-detector",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/octet-stream"
        },
        body: imageBlob
      }
    );

    console.log("⏳ TRACKER 5: Waiting for Hugging Face response...");
    const aiData = await hfResponse.json();
    console.log("✅ TRACKER 6: Hugging Face responded with:", aiData);

    // Safety check if the free AI model is sleeping / loading
    if (aiData.error) {
      console.error("❌ TRACKER AI ERROR:", aiData.error);
      return NextResponse.json({ error: "AI model is waking up! Please try again in 10 seconds." }, { status: 503 });
    }

    // 3. Process the results into easy percentages
    let realPercentage = 0;
    let aiPercentage = 0;

    if (Array.isArray(aiData)) {
      // UPDATED: Standardized matching to support both 'real'/'human' and 'ai'/'fake' labels
      const realItem = aiData.find((item: any) => 
        item.label.toLowerCase() === 'real' || item.label.toLowerCase() === 'human'
      );
      const aiItem = aiData.find((item: any) => 
        item.label.toLowerCase() === 'ai' || item.label.toLowerCase() === 'fake'
      );
      
      if (realItem) realPercentage = Math.round(realItem.score * 100);
      if (aiItem) aiPercentage = Math.round(aiItem.score * 100);
    }

    console.log("⏳ TRACKER 7: Saving predictions to Supabase database...");
    await supabase.from('predictions').insert([
      { 
        image_url: imageUrl, 
        real_percentage: realPercentage, 
        ai_percentage: aiPercentage 
      }
    ]);
    console.log("✅ TRACKER 8: Saved to Database successfully!");

    return NextResponse.json({ real: realPercentage, ai: aiPercentage });

  } catch (error: any) {
    console.error("❌ CRITICAL SERVER ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
