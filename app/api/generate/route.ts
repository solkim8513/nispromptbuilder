import { NextResponse } from "next/server";
import { generateWithProvider } from "@/lib/providers";
import { validateGenerateRequest } from "@/lib/prompting";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const generateRequest = validateGenerateRequest(body);
    const result = await generateWithProvider(generateRequest);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
